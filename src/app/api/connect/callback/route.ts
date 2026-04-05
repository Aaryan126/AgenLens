/**
 * Account linking callback handler.
 *
 * After the user authorizes the secondary provider, Auth0 redirects here.
 * We exchange the code for tokens, extract the secondary user ID, then
 * link it to the primary user via the Management API.
 */

import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const baseUrl = process.env.APP_BASE_URL || "http://localhost:3000";

  // Retrieve the linking state from cookie.
  const linkStateCookie = req.cookies.get("agenlens_link_state");
  if (!linkStateCookie || !code) {
    return NextResponse.redirect(`${baseUrl}/dashboard/connections?error=missing_state`);
  }

  let linkState: { state: string; primaryUserId: string; connection: string };
  try {
    linkState = JSON.parse(linkStateCookie.value);
  } catch {
    return NextResponse.redirect(`${baseUrl}/dashboard/connections?error=invalid_state`);
  }

  // Verify state matches.
  if (linkState.state !== state) {
    return NextResponse.redirect(`${baseUrl}/dashboard/connections?error=state_mismatch`);
  }

  const domain = process.env.AUTH0_ISSUER_BASE_URL;
  const clientId = process.env.AUTH0_CLIENT_ID;
  const clientSecret = process.env.AUTH0_CLIENT_SECRET;

  try {
    // Step 1: Exchange code for tokens to get the secondary user's identity.
    const tokenRes = await fetch(`${domain}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "authorization_code",
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: `${baseUrl}/api/connect/callback`,
      }),
    });

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok) {
      console.error("[Link] Token exchange failed:", tokenData);
      return NextResponse.redirect(`${baseUrl}/dashboard/connections?error=token_exchange`);
    }

    // Step 2: Get the secondary user's profile to find their user ID.
    const profileRes = await fetch(`${domain}/userinfo`, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const profile = await profileRes.json();

    // The secondary user ID is in the sub claim (e.g., "github|12345").
    const secondaryUserId = profile.sub;
    if (!secondaryUserId) {
      console.error("[Link] No sub in profile:", profile);
      return NextResponse.redirect(`${baseUrl}/dashboard/connections?error=no_profile`);
    }

    // Step 3: Get a Management API token.
    const mgmtTokenRes = await fetch(`${domain}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        audience: `${domain}/api/v2/`,
        grant_type: "client_credentials",
      }),
    });
    const mgmtToken = await mgmtTokenRes.json();

    if (!mgmtToken.access_token) {
      console.error("[Link] Failed to get management token");
      return NextResponse.redirect(`${baseUrl}/dashboard/connections?error=mgmt_token`);
    }

    // Step 4: Link the secondary identity to the primary user.
    const [secondaryProvider, secondaryId] = secondaryUserId.split("|");

    const linkRes = await fetch(
      `${domain}/api/v2/users/${encodeURIComponent(linkState.primaryUserId)}/identities`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${mgmtToken.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          provider: secondaryProvider,
          user_id: secondaryId,
        }),
      }
    );

    if (!linkRes.ok) {
      const linkError = await linkRes.json().catch(() => ({}));
      console.error("[Link] Account linking failed:", linkError);
      // If already linked, that's fine.
      if (linkError.statusCode !== 409) {
        return NextResponse.redirect(`${baseUrl}/dashboard/connections?error=link_failed`);
      }
    } else {
      console.log(`[Link] Successfully linked ${secondaryUserId} to ${linkState.primaryUserId}`);
    }

    // Clear the cookie and redirect.
    const response = NextResponse.redirect(`${baseUrl}/dashboard/connections`);
    response.cookies.delete("agenlens_link_state");
    return response;
  } catch (error) {
    console.error("[Link] Error:", error);
    return NextResponse.redirect(`${baseUrl}/dashboard/connections?error=unknown`);
  }
}
