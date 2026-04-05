/**
 * Connected Accounts route handler.
 *
 * Uses Auth0 SDK's startInteractiveLogin with connection parameter
 * to force re-authentication with the specific provider, storing
 * refresh tokens in Token Vault.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0/client";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const connection = req.nextUrl.searchParams.get("connection");

  if (!connection) {
    return NextResponse.json({ error: "Missing connection parameter" }, { status: 400 });
  }

  try {
    return await auth0.startInteractiveLogin({
      authorizationParameters: {
        connection,
        prompt: "consent",
        access_type: "offline",
      },
      returnTo: "/dashboard/connections",
    });
  } catch (error) {
    console.error("[Connect] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to initiate connection" },
      { status: 500 }
    );
  }
}
