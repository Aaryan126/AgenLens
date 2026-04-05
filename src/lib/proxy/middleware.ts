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
 * 4. If step-up required, initiates CIBA and waits for approval
 * 5. If allowed, injects the auth token from Token Vault and forwards the request
 * 6. Logs the full request/response cycle
 * 7. Emits a real-time event for the dashboard
 *
 * Sub-agents NEVER hold raw third-party tokens. The proxy injects them.
 */

import { auth0 } from "@/lib/auth0/client";
import { initiateCIBA, pollCIBAResult } from "@/lib/auth0/client";
import { evaluatePolicy } from "@/lib/proxy/policy-engine";
import { logActivity } from "@/lib/proxy/logger";
import { db } from "@/lib/db";
import type { AgentType, ProxyRequest, ProxyResponse } from "@/lib/types";
import { AGENT_SCOPE_CONFIG } from "@/lib/types";

/** Maximum number of CIBA polling attempts before timing out. */
const CIBA_MAX_POLLS = 60;
/** Interval between CIBA polling attempts in milliseconds. */
const CIBA_POLL_INTERVAL_MS = 5000;

/**
 * Processes a proxied API request from a sub-agent.
 *
 * This is the main entry point for all sub-agent API calls. It handles
 * policy evaluation, step-up auth, token injection, request forwarding,
 * and activity logging in a single pipeline.
 *
 * @param request - The sub-agent's API request (without auth headers)
 * @param userAccessToken - The user's Auth0 access token for Token Vault exchange
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
        stepUpId: stepUpResult.authReqId,
        stepUpResult: "denied",
      });

      return {
        status: 403,
        headers: {},
        body: {
          error: "step_up_denied",
          reason: stepUpResult.reason,
        },
        durationMs: Date.now() - startTime,
      };
    }
  }

  // Step 4: Get the scoped token from Token Vault.
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
    // Use pre-fetched provider token if available (fetched in chat route where session exists).
    // Fall back to SDK method (only works when session context is available).
    const preFetched = providerTokens?.[config.connection];
    if (preFetched) {
      providerToken = preFetched;
    } else {
      const tokenResult = await auth0.getAccessTokenForConnection({
        connection: config.connection,
      });
      providerToken = tokenResult.token;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Token exchange failed";
    console.error("[Proxy] Token exchange failed:", message);

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

    // Detect expired token and return a clear error.
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
    policyResult: "allowed",
    scopesUsed: config.defaultScopes,
  });

  return response;
}

/**
 * Handles step-up authentication via CIBA for a sensitive action.
 *
 * Initiates a CIBA request, creates a step-up event in the database,
 * and polls for the user's decision.
 *
 * @param request - The proxy request that triggered step-up
 * @returns Whether the user approved and the CIBA auth_req_id
 */
async function handleStepUp(
  request: ProxyRequest
): Promise<{ approved: boolean; reason: string; authReqId?: string }> {
  const bindingMessage = `${request.agentType} agent wants to ${request.method} ${request.url}`;

  try {
    const cibaResult = await initiateCIBA(request.userId, bindingMessage, [
      {
        type: "agent_action",
        agent: request.agentType,
        method: request.method,
        resource: request.url,
      },
    ]);

    // Create step-up event in DB for dashboard visibility.
    await db.stepUpEvent.create({
      data: {
        userId: request.userId,
        activityId: "", // Will be linked when activity is logged.
        agentType: request.agentType,
        actionDescription: bindingMessage,
        cibaAuthReqId: cibaResult.auth_req_id,
        status: "pending",
      },
    });

    // Poll for user decision.
    const pollInterval = Math.max(
      cibaResult.interval * 1000,
      CIBA_POLL_INTERVAL_MS
    );

    for (let i = 0; i < CIBA_MAX_POLLS; i++) {
      await new Promise((resolve) => setTimeout(resolve, pollInterval));

      const result = await pollCIBAResult(cibaResult.auth_req_id);

      if (result) {
        await db.stepUpEvent.updateMany({
          where: { cibaAuthReqId: cibaResult.auth_req_id },
          data: {
            status: "approved",
            resolvedAt: new Date(),
            tokenExpiresAt: new Date(
              Date.now() + result.expires_in * 1000
            ),
          },
        });

        return {
          approved: true,
          reason: "User approved the action",
          authReqId: cibaResult.auth_req_id,
        };
      }
    }

    // Timed out waiting for user response.
    await db.stepUpEvent.updateMany({
      where: { cibaAuthReqId: cibaResult.auth_req_id },
      data: { status: "expired", resolvedAt: new Date() },
    });

    return {
      approved: false,
      reason: "Step-up authentication timed out",
      authReqId: cibaResult.auth_req_id,
    };
  } catch (error) {
    const isDenied =
      error instanceof Error && error.message.includes("access_denied");

    if (isDenied) {
      return {
        approved: false,
        reason: "User denied the action",
      };
    }

    return {
      approved: false,
      reason: `Step-up authentication failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Builds a human-readable description of an API action for the activity log.
 *
 * Translates raw HTTP method + endpoint into something meaningful like
 * "Read calendar event 'Design Sync'" instead of "GET /calendar/v3/...".
 *
 * @param request - The proxied request
 * @param response - The response from the external API
 * @returns Human-readable action description
 */
function buildActionDescription(
  request: ProxyRequest,
  response: ProxyResponse
): string {
  const method = request.method.toUpperCase();
  const url = request.url;
  const agent = request.agentType;

  // Google Calendar actions.
  if (url.includes("googleapis.com/calendar")) {
    if (method === "GET" && url.includes("/events")) {
      return `Read calendar events`;
    }
    if (method === "POST" && url.includes("/events")) {
      return `Created a calendar event`;
    }
    if (method === "PUT" || method === "PATCH") {
      return `Updated a calendar event`;
    }
    if (method === "DELETE") {
      return `Deleted a calendar event`;
    }
    return `Accessed Google Calendar`;
  }

  // Gmail actions.
  if (url.includes("googleapis.com/gmail")) {
    if (method === "GET" && url.includes("/messages")) {
      return `Read email messages`;
    }
    if (method === "POST" && url.includes("/send")) {
      return `Sent an email`;
    }
    if (method === "GET" && url.includes("/threads")) {
      return `Read email threads`;
    }
    if (method === "POST" && url.includes("/drafts")) {
      return `Created an email draft`;
    }
    return `Accessed Gmail`;
  }

  // GitHub actions.
  if (url.includes("api.github.com")) {
    if (url.includes("/pulls")) {
      return method === "GET"
        ? `Read pull requests`
        : `Modified a pull request`;
    }
    if (url.includes("/issues")) {
      return method === "GET" ? `Read issues` : `Modified an issue`;
    }
    if (url.includes("/repos") && method === "GET") {
      return `Read repository data`;
    }
    return `Accessed GitHub`;
  }

  // Slack actions.
  if (url.includes("slack.com/api")) {
    if (url.includes("conversations")) {
      return `Read Slack channels`;
    }
    if (url.includes("chat.postMessage")) {
      return `Posted a Slack message`;
    }
    if (url.includes("search")) {
      return `Searched Slack messages`;
    }
    if (url.includes("users")) {
      return `Looked up Slack users`;
    }
    return `Accessed Slack`;
  }

  // Google Drive actions.
  if (url.includes("googleapis.com/drive")) {
    if (method === "GET" && url.includes("/files")) {
      return `Read Drive files`;
    }
    if (method === "POST") {
      return `Uploaded a file to Drive`;
    }
    return `Accessed Google Drive`;
  }

  // Fallback: generic description.
  return `${agent} agent: ${method} ${new URL(url).pathname}`;
}
