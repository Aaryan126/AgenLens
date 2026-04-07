/**
 * Core proxy middleware for AgenLens.
 *
 * This is the central piece of the system - the layer between sub-agents
 * and external APIs. Every API call from a sub-agent passes through here.
 *
 * The proxy:
 * 1. Receives the request from a sub-agent
 * 2. Evaluates it against the policy engine
 * 3. If blocked, logs the violation and returns an error
 * 4. If step-up required, creates an in-app approval and polls for user decision
 * 5. If allowed, injects the auth token and forwards the request
 * 6. Logs the full request/response cycle
 *
 * Sub-agents NEVER hold raw third-party tokens. The proxy injects them.
 */

import { auth0 } from "@/lib/auth0/client";
import { evaluatePolicy } from "@/lib/proxy/policy-engine";
import { logActivity } from "@/lib/proxy/logger";
import { db } from "@/lib/db";
import type { AgentType, ProxyRequest, ProxyResponse, StepUpStatus } from "@/lib/types";
import { AGENT_SCOPE_CONFIG } from "@/lib/types";

/** Maximum number of polling attempts before timing out (12 * 5s = 60s). */
const APPROVAL_MAX_POLLS = 12;
/** Interval between polling attempts in milliseconds. */
const APPROVAL_POLL_INTERVAL_MS = 5000;

/**
 * Processes a proxied API request from a sub-agent.
 *
 * This is the main entry point for all sub-agent API calls. It handles
 * policy evaluation, step-up auth, token injection, request forwarding,
 * and activity logging in a single pipeline.
 *
 * @param request - The sub-agent's API request (without auth headers)
 * @param userAccessToken - The user's Auth0 access token for Token Vault exchange
 * @param providerTokens - Pre-fetched provider tokens from the chat route
 * @returns The proxied response, or an error response if blocked
 */
export async function proxyRequest(
  request: ProxyRequest,
  userAccessToken: string,
  providerTokens?: Record<string, string>
): Promise<ProxyResponse> {
  const startTime = Date.now();

  // Step 1: Evaluate policies.
  const policyEval = await evaluatePolicy(request);

  // Step 2: Handle blocked requests.
  if (policyEval.result === "blocked") {
    await logActivity({
      request,
      response: null,
      action: `Blocked: ${policyEval.reason}`,
      policyResult: "blocked",
      scopesUsed: [],
    });

    return {
      status: 403,
      headers: {},
      body: { error: "blocked_by_policy", reason: policyEval.reason },
      durationMs: Date.now() - startTime,
    };
  }

  // Step 3: Handle step-up authentication if required.
  if (policyEval.result === "step_up_required") {
    const stepUpResult = await handleStepUp(request);

    if (!stepUpResult.approved) {
      await logActivity({
        request,
        response: null,
        action: `Denied: ${stepUpResult.reason}`,
        policyResult: "step_up_required",
        scopesUsed: [],
        stepUpId: stepUpResult.approvalId,
        stepUpResult: stepUpResult.status,
      });

      return {
        status: 403,
        headers: {},
        body: {
          error: stepUpResult.status === "expired" ? "step_up_expired" : "step_up_denied",
          reason: stepUpResult.reason,
        },
        durationMs: Date.now() - startTime,
      };
    }
  }

  // Step 4: Get the scoped token.
  const agentType = request.agentType as Exclude<AgentType, "supervisor">;
  const config = AGENT_SCOPE_CONFIG[agentType];

  if (!config) {
    return {
      status: 400,
      headers: {},
      body: { error: "unknown_agent_type", agentType: request.agentType },
      durationMs: Date.now() - startTime,
    };
  }

  let providerToken: string;
  try {
    // Always fetch a fresh token from Management API right before forwarding.
    // Pre-fetched tokens may be stale if approval took time.
    const freshToken = await fetchFreshProviderToken(request.userId, config.connection);
    if (freshToken) {
      providerToken = freshToken;
    } else {
      // Fall back to pre-fetched token.
      const preFetched = providerTokens?.[config.connection];
      if (preFetched) {
        providerToken = preFetched;
      } else {
        throw new Error(`No token available for ${config.connection}`);
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Token exchange failed";

    await logActivity({
      request,
      response: null,
      action: `Token exchange failed: ${message}`,
      policyResult: "allowed",
      scopesUsed: [],
    });

    return {
      status: 502,
      headers: {},
      body: { error: "token_exchange_failed", message },
      durationMs: Date.now() - startTime,
    };
  }

  // Step 5: Forward the request with the injected token.
  let response: ProxyResponse;
  try {
    const externalResponse = await fetch(request.url, {
      method: request.method,
      headers: {
        ...request.headers,
        Authorization: `Bearer ${providerToken}`,
        "Content-Type": "application/json",
      },
      body: request.body ? JSON.stringify(request.body) : undefined,
    });

    const responseBody = await externalResponse.json().catch(() => null);

    if (externalResponse.status === 401) {
      await logActivity({
        request,
        response: null,
        action: `Token expired for ${config.connection}. Please reconnect.`,
        policyResult: "allowed",
        scopesUsed: config.defaultScopes,
      });

      return {
        status: 401,
        headers: {},
        body: { error: "token_expired", connection: config.connection, message: "Provider token has expired. Please reconnect your account." },
        durationMs: Date.now() - startTime,
      };
    }

    response = {
      status: externalResponse.status,
      headers: Object.fromEntries(externalResponse.headers.entries()),
      body: responseBody,
      durationMs: Date.now() - startTime,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Request failed";

    response = {
      status: 502,
      headers: {},
      body: { error: "upstream_request_failed", message },
      durationMs: Date.now() - startTime,
    };
  }

  // Step 6: Log the activity.
  const action = buildActionDescription(request, response);
  await logActivity({
    request,
    response,
    action,
    policyResult: policyEval.result === "step_up_required" ? "step_up_required" : "allowed",
    scopesUsed: config.defaultScopes,
  });

  return response;
}

/**
 * Handles step-up authentication via in-app approval.
 *
 * Creates a pending StepUpEvent in the database and polls for the user's
 * decision. The frontend shows an approval card and calls /api/approvals/resolve
 * to approve or deny.
 *
 * @param request - The proxy request that triggered step-up
 * @returns Whether the user approved, the reason, and the approval ID
 */
async function handleStepUp(
  request: ProxyRequest
): Promise<{ approved: boolean; reason: string; approvalId?: string; status: StepUpStatus }> {
  const actionDescription = buildApprovalDescription(request);

  try {
    // Create a pending approval in the database.
    const approval = await db.stepUpEvent.create({
      data: {
        userId: request.userId,
        agentType: request.agentType,
        actionDescription,
        requestId: request.requestId,
        targetService: request.targetService,
        httpMethod: request.method,
        endpoint: request.url,
        status: "pending",
      },
    });


    // Poll the database for the user's decision.
    for (let i = 0; i < APPROVAL_MAX_POLLS; i++) {
      await new Promise((resolve) => setTimeout(resolve, APPROVAL_POLL_INTERVAL_MS));

      const updated = await db.stepUpEvent.findUnique({
        where: { id: approval.id },
      });

      if (!updated) {
        return { approved: false, reason: "Approval record not found", status: "denied" };
      }

      if (updated.status === "approved") {
        return {
          approved: true,
          reason: "User approved the action",
          approvalId: approval.id,
          status: "approved",
        };
      }

      if (updated.status === "denied") {
        return {
          approved: false,
          reason: "User denied the action",
          approvalId: approval.id,
          status: "denied",
        };
      }
    }

    // Timed out.
    await db.stepUpEvent.update({
      where: { id: approval.id },
      data: { status: "expired", resolvedAt: new Date() },
    });

    return {
      approved: false,
      reason: "Approval timed out after 60 seconds",
      approvalId: approval.id,
      status: "expired",
    };
  } catch (error) {
    return {
      approved: false,
      reason: `Step-up authentication failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      status: "denied",
    };
  }
}

/**
 * Fetches a fresh provider token for the user.
 *
 * Strategy:
 * 1. Get the user's identity from Auth0 Management API
 * 2. If a refresh_token is available for the provider, exchange it directly
 *    with the provider's token endpoint for a fresh access token
 * 3. Fall back to the stored access_token if no refresh_token
 *
 * This handles Google access token expiry (1 hour) automatically by using
 * the refresh token to get a new access token on every request.
 */
async function fetchFreshProviderToken(
  userId: string,
  connection: string
): Promise<string | null> {
  try {
    const domain = process.env.AUTH0_ISSUER_BASE_URL;
    const mgmtTokenRes = await fetch(`${domain}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: process.env.AUTH0_CLIENT_ID,
        client_secret: process.env.AUTH0_CLIENT_SECRET,
        audience: `${domain}/api/v2/`,
        grant_type: "client_credentials",
      }),
    });
    const mgmtToken = await mgmtTokenRes.json();
    if (!mgmtToken.access_token) return null;

    const userRes = await fetch(
      `${domain}/api/v2/users/${encodeURIComponent(userId)}`,
      { headers: { Authorization: `Bearer ${mgmtToken.access_token}` } }
    );
    const userData = await userRes.json();

    if (!userData.identities) return null;

    for (const identity of userData.identities) {
      const connName = identity.connection || identity.provider;
      if (connName !== connection) continue;

      // If we have a refresh token, exchange it for a fresh access token.
      if (identity.refresh_token && connection === "google-oauth2") {
        const freshToken = await refreshGoogleToken(identity.refresh_token);
        if (freshToken) {
          return freshToken;
        }
      }

      // Fall back to stored access token.
      if (identity.access_token) {
        return identity.access_token;
      }
    }

    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Exchanges a Google refresh token for a fresh access token
 * directly with Google's OAuth endpoint.
 */
async function refreshGoogleToken(refreshToken: string): Promise<string | null> {
  try {
    // Google OAuth credentials are stored in the Auth0 connection,
    // but we also need them here for direct refresh.
    // These are the same credentials used in the Auth0 Google connection.
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return null;
    }

    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return null;
    }

    const data = await res.json();
    return data.access_token || null;
  } catch {
    return null;
  }
}

/**
 * Builds a human-readable description for an approval prompt.
 * Designed to be clear to end users about what the agent wants to do.
 */
function buildApprovalDescription(request: ProxyRequest): string {
  const agent = request.agentType.charAt(0).toUpperCase() + request.agentType.slice(1);
  const method = request.method.toUpperCase();
  const url = request.url;

  if (url.includes("googleapis.com/calendar") && method === "POST") {
    const summary = (request.body as Record<string, unknown>)?.summary || "an event";
    return `${agent} Agent wants to create a calendar event: "${summary}"`;
  }

  if (url.includes("googleapis.com/gmail") && url.includes("/send")) {
    const body = request.body as Record<string, unknown>;
    return `${agent} Agent wants to send an email`;
  }

  if (url.includes("api.github.com") && url.includes("/issues") && method === "POST") {
    const title = (request.body as Record<string, unknown>)?.title || "an issue";
    return `${agent} Agent wants to create a GitHub issue: "${title}"`;
  }

  if (url.includes("slack.com/api") && url.includes("chat.postMessage")) {
    const channel = (request.body as Record<string, unknown>)?.channel || "a channel";
    return `${agent} Agent wants to post a message to Slack channel: ${channel}`;
  }

  if (url.includes("googleapis.com/drive") && method === "POST") {
    return `${agent} Agent wants to upload a file to Google Drive`;
  }

  return `${agent} Agent wants to perform a ${method} request to ${request.targetService}`;
}

/**
 * Builds a human-readable description of an API action for the activity log.
 */
function buildActionDescription(
  request: ProxyRequest,
  response: ProxyResponse
): string {
  const method = request.method.toUpperCase();
  const url = request.url;
  const agent = request.agentType;

  if (url.includes("googleapis.com/calendar")) {
    if (method === "GET" && url.includes("/events")) return `Read calendar events`;
    if (method === "POST" && url.includes("/events")) return `Created a calendar event`;
    if (method === "PUT" || method === "PATCH") return `Updated a calendar event`;
    if (method === "DELETE") return `Deleted a calendar event`;
    return `Accessed Google Calendar`;
  }

  if (url.includes("googleapis.com/gmail")) {
    if (method === "GET" && url.includes("/messages")) return `Read email messages`;
    if (method === "POST" && url.includes("/send")) return `Sent an email`;
    if (method === "GET" && url.includes("/threads")) return `Read email threads`;
    if (method === "POST" && url.includes("/drafts")) return `Created an email draft`;
    return `Accessed Gmail`;
  }

  if (url.includes("api.github.com")) {
    if (url.includes("/pulls")) return method === "GET" ? `Read pull requests` : `Modified a pull request`;
    if (url.includes("/issues")) return method === "GET" ? `Read issues` : `Created an issue`;
    if (url.includes("/commits")) return `Read commits`;
    if (url.includes("/repos") && method === "GET") return `Read repository data`;
    return `Accessed GitHub`;
  }

  if (url.includes("slack.com/api")) {
    if (url.includes("conversations")) return `Read Slack channels`;
    if (url.includes("chat.postMessage")) return `Posted a Slack message`;
    if (url.includes("search")) return `Searched Slack messages`;
    if (url.includes("users")) return `Looked up Slack users`;
    return `Accessed Slack`;
  }

  if (url.includes("googleapis.com/drive")) {
    if (method === "GET" && url.includes("/files")) return `Read Drive files`;
    if (method === "POST") return `Uploaded a file to Drive`;
    return `Accessed Google Drive`;
  }

  return `${agent} agent: ${method} ${new URL(url).pathname}`;
}
