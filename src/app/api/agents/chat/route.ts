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

    const response = await invokeSupervisor(message, {
      sessionId: activeSessionId,
      requestId,
      userId: session.user.sub,
      userAccessToken: accessToken,
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
