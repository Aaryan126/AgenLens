/**
 * Auth0 client configuration for AgenLens.
 *
 * Sets up the Auth0 Next.js SDK for user authentication and provides
 * helper functions for Token Vault token exchange and CIBA step-up flows.
 *
 * The SDK v4 natively supports Token Vault via getAccessTokenForConnection(),
 * but we also provide a raw exchange function for cases where we need
 * direct control (e.g., the proxy layer exchanging tokens on behalf of sub-agents).
 */

import { Auth0Client } from "@auth0/nextjs-auth0/server";

/**
 * Auth0 Next.js SDK client instance.
 * Handles user authentication, session management, and token operations.
 */
export const auth0 = new Auth0Client();

/**
 * Gets a scoped access token for a connected third-party provider
 * using Auth0 Token Vault via the SDK's native method.
 *
 * This is the preferred method when running within a Next.js request context
 * (e.g., in API routes or server components).
 *
 * @param connection - The Auth0 connection name (e.g., "google-oauth2", "github")
 * @returns The external provider's access token
 */
export async function getTokenForConnection(
  connection: string
): Promise<{ token: string; expiresAt?: number }> {
  const result = await auth0.getAccessTokenForConnection({ connection });
  return { token: result.token, expiresAt: result.expiresAt };
}

/**
 * Exchanges an Auth0 access token for an external provider access token
 * via the Token Vault token exchange endpoint (RFC 8693).
 *
 * This is used by the proxy layer when it needs to exchange tokens outside
 * of a normal Next.js request context. The proxy receives a user's Auth0
 * access token and exchanges it for a provider-specific token.
 *
 * @param subjectToken - The Auth0 access token or refresh token to exchange
 * @param connection - The Auth0 connection name (e.g., "google-oauth2", "github")
 * @param tokenType - Whether the subject token is an access_token or refresh_token
 * @returns The external provider's access token and metadata
 */
export async function exchangeTokenVault(
  subjectToken: string,
  connection: string,
  tokenType: "access_token" | "refresh_token" = "access_token"
): Promise<{
  access_token: string;
  scope: string;
  expires_in: number;
  token_type: string;
}> {
  const domain = process.env.AUTH0_ISSUER_BASE_URL;
  const clientId = process.env.AUTH0_CLIENT_ID;
  const clientSecret = process.env.AUTH0_CLIENT_SECRET;

  if (!domain || !clientId || !clientSecret) {
    throw new Error(
      "Missing Auth0 environment variables for Token Vault exchange"
    );
  }

  const subjectTokenType =
    tokenType === "refresh_token"
      ? "urn:ietf:params:oauth:token-type:refresh_token"
      : "urn:ietf:params:oauth:token-type:access_token";

  const response = await fetch(`${domain}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      subject_token: subjectToken,
      grant_type:
        "urn:auth0:params:oauth:grant-type:token-exchange:federated-connection-access-token",
      subject_token_type: subjectTokenType,
      requested_token_type:
        "http://auth0.com/oauth/token-type/federated-connection-access-token",
      connection,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      `Token Vault exchange failed for ${connection}: ${error.error_description || response.statusText}`
    );
  }

  return response.json();
}

/**
 * Initiates a CIBA (Client-Initiated Backchannel Authentication) request
 * for step-up authentication. Sends a push notification to the user
 * for explicit approval before a sensitive agent action proceeds.
 *
 * @param userId - The Auth0 user ID (sub claim)
 * @param bindingMessage - Short message shown to the user describing the action
 * @param authorizationDetails - Rich Authorization Request details for the action
 * @returns The CIBA auth_req_id for polling the result
 */
export async function initiateCIBA(
  userId: string,
  bindingMessage: string,
  authorizationDetails?: Record<string, unknown>[]
): Promise<{ auth_req_id: string; expires_in: number; interval: number }> {
  const domain = process.env.AUTH0_ISSUER_BASE_URL;
  const clientId = process.env.AUTH0_CIBA_CLIENT_ID || process.env.AUTH0_CLIENT_ID;
  const clientSecret = process.env.AUTH0_CIBA_CLIENT_SECRET || process.env.AUTH0_CLIENT_SECRET;

  if (!domain || !clientId || !clientSecret) {
    throw new Error("Missing Auth0 environment variables for CIBA");
  }

  const body: Record<string, unknown> = {
    client_id: clientId,
    client_secret: clientSecret,
    login_hint: JSON.stringify({ format: "iss_sub", iss: domain, sub: userId }),
    binding_message: bindingMessage,
    scope: "openid",
  };

  if (authorizationDetails) {
    body.authorization_details = JSON.stringify(authorizationDetails);
  }

  const response = await fetch(`${domain}/bc-authorize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      `CIBA initiation failed: ${error.error_description || response.statusText}`
    );
  }

  return response.json();
}

/**
 * Polls the Auth0 token endpoint for the result of a CIBA authentication request.
 * Returns the token if approved, null if still pending, or throws if denied/expired.
 *
 * @param authReqId - The CIBA auth_req_id returned by initiateCIBA
 * @returns Access token if approved, null if still pending
 * @throws Error if the request was denied or expired
 */
export async function pollCIBAResult(
  authReqId: string
): Promise<{ access_token: string; token_type: string; expires_in: number } | null> {
  const domain = process.env.AUTH0_ISSUER_BASE_URL;
  const clientId = process.env.AUTH0_CIBA_CLIENT_ID || process.env.AUTH0_CLIENT_ID;
  const clientSecret = process.env.AUTH0_CIBA_CLIENT_SECRET || process.env.AUTH0_CLIENT_SECRET;

  const response = await fetch(`${domain}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "urn:openid:params:grant-type:ciba",
      auth_req_id: authReqId,
    }),
  });

  if (response.ok) {
    return response.json();
  }

  const error = await response.json().catch(() => ({}));

  if (error.error === "authorization_pending" || error.error === "slow_down") {
    return null;
  }

  throw new Error(
    `CIBA polling failed: ${error.error_description || error.error || response.statusText}`
  );
}
