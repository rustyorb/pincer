import { NextRequest, NextResponse } from "next/server";

/**
 * Middleware to protect all routes when auth is enabled.
 *
 * Auth is considered enabled when both PINCER_USERNAME and PINCER_PASSWORD
 * are set AND PINCER_AUTH_DISABLED is not "true".
 *
 * We can't import the full auth module here (middleware runs on the Edge
 * runtime in some deployments), so we do a lightweight cookie check and
 * let the API routes do full HMAC validation.
 *
 * Unprotected paths:
 * - /login (login page)
 * - /api/auth/* (auth endpoints)
 * - /_next/* (Next.js internals)
 * - /favicon.ico, static assets
 */

const PUBLIC_PATHS = [
  "/login",
  "/api/auth/",
  "/_next/",
  "/favicon.ico",
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname.startsWith(p));
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always allow public paths
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // Check if auth is enabled via env vars
  const authEnabled =
    process.env.PINCER_AUTH_DISABLED !== "true" &&
    !!process.env.PINCER_USERNAME &&
    !!process.env.PINCER_PASSWORD;

  if (!authEnabled) {
    return NextResponse.next();
  }

  // Check for session cookie
  const sessionCookie = request.cookies.get("pincer_session")?.value;

  if (!sessionCookie) {
    // API routes get 401, pages get redirected to /login
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Cookie exists — let the request through.
  // Full HMAC validation happens in the auth status endpoint.
  // The middleware can't do crypto on Edge, so this is a presence check.
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all paths except static files
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
