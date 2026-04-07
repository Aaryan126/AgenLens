/**
 * API Proxy route handler for AgenLens.
 *
 * This is the single entry point for all sub-agent API calls to external services.
 * Sub-agents POST to this endpoint with their request details, and the proxy:
 * 1. Validates the session
 * 2. Evaluates policies
 * 3. Handles step-up auth if needed
 * 4. Injects the token from Token Vault
 * 5. Forwards the request
 * 6. Logs everything
 *
 * Sub-agents never receive raw tokens. The proxy is the only component
 * that interacts with Token Vault and external APIs.
 */

import { NextRequest, NextResponse } from "next/server";
import { proxyRequest } from "@/lib/proxy/middleware";
import type { ProxyRequest } from "@/lib/types";

/**
 * POST /api/proxy
 *
 * Proxies an API request from a sub-agent to an external service.
 * Requires a valid user session and access token.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();

    const {
      agentType,
      method,
      url,
      body: requestBody,
      sessionId,
      requestId,
      userId,
      userAccessToken,
      providerTokens,
    } = body;

    if (!agentType || !method || !url || !userId || !userAccessToken) {
      return NextResponse.json(
        { error: "Missing required fields: agentType, method, url, userId, userAccessToken" },
        { status: 400 }
      );
    }

    const proxyReq: ProxyRequest = {
      agentType,
      targetService: extractServiceName(url),
      method: method.toUpperCase(),
      url,
      headers: {},
      body: requestBody,
      sessionId: sessionId || "unknown",
      requestId: requestId || "unknown",
      userId,
    };

    const result = await proxyRequest(proxyReq, userAccessToken, providerTokens);

    return NextResponse.json(
      { data: result.body, status: result.status },
      { status: result.status >= 400 ? result.status : 200 }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Internal proxy error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Extracts a human-readable service name from an API URL.
 *
 * @param url - The full API URL
 * @returns Service name like "Google Calendar", "Gmail", "GitHub", etc.
 */
function extractServiceName(url: string): string {
  if (url.includes("googleapis.com/calendar")) return "Google Calendar";
  if (url.includes("googleapis.com/gmail")) return "Gmail";
  if (url.includes("googleapis.com/drive")) return "Google Drive";
  if (url.includes("api.github.com")) return "GitHub";
  return new URL(url).hostname;
}
