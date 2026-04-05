/**
 * Next.js middleware for Auth0 authentication.
 *
 * Auth0 Next.js SDK v4 uses middleware to handle auth routes
 * (/auth/login, /auth/callback, /auth/logout, /auth/profile).
 * Only delegates to Auth0 middleware for /auth/* paths.
 */

import { NextResponse, type NextRequest } from "next/server";
import { auth0 } from "@/lib/auth0/client";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/auth/")) {
    return await auth0.middleware(request);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
