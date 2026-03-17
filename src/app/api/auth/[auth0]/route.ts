/**
 * Auth0 authentication route handler.
 *
 * Handles all Auth0 authentication flows: login, logout, callback,
 * and profile. In Auth0 Next.js SDK v4, the middleware approach is used
 * for App Router. This route delegates to the auth0 middleware.
 */

import { NextRequest } from "next/server";
import { auth0 } from "@/lib/auth0/client";

export async function GET(req: NextRequest) {
  return auth0.middleware(req);
}

export async function POST(req: NextRequest) {
  return auth0.middleware(req);
}
