/**
 * Connected Accounts route handler.
 *
 * Uses Auth0 account linking to add a secondary identity (provider)
 * to the current user. This way the user keeps their primary identity
 * and can access tokens from all linked providers.
 *
 * Flow:
 * 1. User clicks "Connect GitHub" while logged in as Google
 * 2. We redirect to Auth0 authorize with the target connection
 * 3. Auth0 callback returns to /api/connect/callback with a code
 * 4. We exchange the code for tokens, then link the identity via Management API
 */

import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0/client";
import crypto from "crypto";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const connection = req.nextUrl.searchParams.get("connection");

  if (!connection) {
    return NextResponse.json({ error: "Missing connection parameter" }, { status: 400 });
  }

  const session = await auth0.getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const primaryProvider = session.user.sub.split("|")[0];

  // If connecting the same provider as the primary identity, just re-auth to refresh tokens.
  if (connection === primaryProvider ||
      (connection === "google-oauth2" && primaryProvider === "google-oauth2") ||
      (connection === "github" && primaryProvider === "github")) {
    try {
      return await auth0.startInteractiveLogin({
        authorizationParameters: {
          connection,
          prompt: "consent",
          access_type: "offline",
        },
        returnTo: "/dashboard/connections",
      });
    } catch {
      return NextResponse.json({ error: "Failed to reconnect" }, { status: 500 });
    }
  }

  // For a different provider, use account linking.
  // Step 1: Redirect to Auth0 authorize for the secondary provider.
  const domain = process.env.AUTH0_ISSUER_BASE_URL;
  const clientId = process.env.AUTH0_CLIENT_ID;
  const baseUrl = process.env.APP_BASE_URL || "http://localhost:3000";
  const state = crypto.randomBytes(16).toString("hex");

  // Store the state and primary user ID in a cookie for the callback.
  const cookieValue = JSON.stringify({
    state,
    primaryUserId: session.user.sub,
    connection,
  });

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId!,
    redirect_uri: `${baseUrl}/api/connect/callback`,
    connection,
    scope: "openid profile email",
    state,
    prompt: "consent",
  });

  const response = NextResponse.redirect(`${domain}/authorize?${params.toString()}`);
  response.cookies.set("agenlens_link_state", cookieValue, {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    maxAge: 300,
    path: "/",
  });

  return response;
}
