/**
 * Agent chat route handler for AgenLens.
 *
 * Receives user messages from the chat interface, invokes the supervisor
 * agent, and returns the response. Handles session management and
 * passes auth tokens to the agent for Token Vault exchanges.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0/client";
import { invokeSupervisor } from "@/lib/agents/supervisor";
import { generateRequestId, generateSessionId } from "@/lib/utils";

/**
 * POST /api/agents/chat
 *
 * Sends a message to the supervisor agent and returns its response.
 * The supervisor decomposes the request into sub-tasks, delegates to
 * sub-agents (all routed through the proxy), and synthesizes results.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await auth0.getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { message, sessionId } = body;

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "Missing required field: message" },
        { status: 400 }
      );
    }

    const activeSessionId = sessionId || generateSessionId();
    const requestId = generateRequestId();

    // Get the user's access token for Token Vault exchanges.
    const { token: accessToken } = await auth0.getAccessToken();

    if (!accessToken) {
      return NextResponse.json(
        { error: "No access token available. Please re-authenticate." },
        { status: 401 }
      );
    }

    // Fetch provider tokens. Try Token Vault first, fall back to Management API.
    const providerTokens: Record<string, string> = {};
    const connections = ["google-oauth2", "github"];

    // Attempt 1: Token Vault (getAccessTokenForConnection).
    // This method uses the session's refresh token to get a fresh provider token.
    for (const connection of connections) {
      try {
        const result = await auth0.getAccessTokenForConnection({ connection });
        providerTokens[connection] = result.token;
      } catch {
        // Token Vault exchange failed; will try Management API fallback.
      }
    }

    // Attempt 2: Management API fallback for connections that failed.
    const missing = connections.filter((c) => !providerTokens[c]);
    if (missing.length > 0) {
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

        if (mgmtToken.access_token) {
          const userRes = await fetch(
            `${domain}/api/v2/users/${encodeURIComponent(session.user.sub)}`,
            { headers: { Authorization: `Bearer ${mgmtToken.access_token}` } }
          );
          const userData = await userRes.json();

          if (userData.identities) {
            for (const identity of userData.identities) {
              if (identity.access_token) {
                const connName = identity.provider === "google-oauth2"
                  ? "google-oauth2"
                  : identity.provider;
                if (!providerTokens[connName]) {
                  providerTokens[connName] = identity.access_token;
                }
              }
            }
          }
        }
      } catch {
        // Management API fallback also failed; agents will report auth errors.
      }
    }

    const response = await invokeSupervisor(message, {
      sessionId: activeSessionId,
      requestId,
      userId: session.user.sub,
      userAccessToken: accessToken,
      providerTokens,
    });

    return NextResponse.json({
      data: {
        response,
        sessionId: activeSessionId,
        requestId,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Agent invocation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
