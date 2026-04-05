/**
 * Connection status API route.
 *
 * Checks which providers are actually connected by looking at the
 * user's Auth0 identities via the Management API. This is the source
 * of truth for connection status, not the local database.
 */

import { NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0/client";

interface IdentityInfo {
  provider: string;
  connection: string;
  isSocial: boolean;
  accessToken?: string;
}

export async function GET(): Promise<NextResponse> {
  try {
    const session = await auth0.getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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

    if (!mgmtToken.access_token) {
      return NextResponse.json({ error: "Failed to get management token" }, { status: 500 });
    }

    const userRes = await fetch(
      `${domain}/api/v2/users/${encodeURIComponent(session.user.sub)}`,
      { headers: { Authorization: `Bearer ${mgmtToken.access_token}` } }
    );
    const userData = await userRes.json();

    const connected: Record<string, IdentityInfo> = {};

    if (userData.identities) {
      for (const identity of userData.identities) {
        connected[identity.connection || identity.provider] = {
          provider: identity.provider,
          connection: identity.connection || identity.provider,
          isSocial: identity.isSocial ?? true,
          accessToken: identity.access_token ? "present" : undefined,
        };
      }
    }

    return NextResponse.json({ data: connected });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to check status";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
