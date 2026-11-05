import { AUTH_COOKIE_PREFIX } from "@repo/shared";
import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

import { REQUEST_PATH_HEADER } from "./lib/request-path";
import { signInPathFor } from "./lib/safe-redirect";

/**
 * Optimistic auth check: redirects to the sign-in page when the session cookie is missing.
 * It does not validate the session nor the role (no API call); the `(admin)` layout verifies
 * both on the server and the API enforces them on every `admin.*` procedure.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const requestPath = `${pathname}${search}`;

  const sessionCookie = getSessionCookie(request, { cookiePrefix: AUTH_COOKIE_PREFIX });
  if (sessionCookie === null) {
    return NextResponse.redirect(new URL(signInPathFor(requestPath), request.url));
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(REQUEST_PATH_HEADER, requestPath);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  // Every page except the sign-in page, the proxied API (`/api/auth`, `/trpc`), Next.js
  // internals and static files (paths with an extension).
  matcher: ["/((?!sign-in|api/|trpc/|_next/|.*\\..*).*)"],
};
