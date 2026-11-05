import type { BetterAuthPlugin } from "better-auth";

/**
 * The only Better Auth endpoints reachable over HTTP (`/api/auth/*`): the ones the apps and the
 * E2E setup call. Everything else Better Auth and its plugins mount answers 404, notably:
 *
 * - `/admin/set-role`, `/admin/update-user`, `/admin/remove-user`, `/admin/impersonate-user`…:
 *   role changes go only through the audited tRPC `admin.setRole` (R-ACC-08, RNF-07), and no
 *   endpoint may delete an actor or act on behalf of another account (RF-12).
 * - `/update-user`: profile edits go through tRPC `user.updateProfile`, validated with zod.
 * - `/expo-authorization-proxy`: an open redirect with no use (there is no social sign-in).
 *
 * The allowlist fails closed: an endpoint added by a Better Auth upgrade stays unreachable until
 * it is listed here. Server-side `auth.api.*` calls (seed) never go through HTTP and are not
 * affected.
 */
export const AUTH_HTTP_PATHS = [
  "/sign-in/email",
  "/sign-out",
  "/get-session",
  /** Disabled (`disableSignUp`): kept so it answers the explicit sign-up-disabled error. */
  "/sign-up/email",
  /** Admin only, residents only: the admin role lacks `user:set-role` (see `AUTH_ROLES`). */
  "/admin/create-user",
] as const;

const ALLOWED_PATHS: ReadonlySet<string> = new Set(AUTH_HTTP_PATHS);

const TRAILING_SLASHES = /\/+$/;

/**
 * Path of a request relative to Better Auth's base path (`/api/auth`), without query string nor
 * trailing slash: `http://h/api/auth/sign-in/email?x=1` → `/sign-in/email`.
 */
export const toAuthPath = (requestUrl: string, baseURL: string): string => {
  const basePath = new URL(baseURL).pathname.replace(TRAILING_SLASHES, "");
  const { pathname } = new URL(requestUrl);
  const isUnderBase = pathname === basePath || pathname.startsWith(`${basePath}/`);
  const relative = isUnderBase ? pathname.slice(basePath.length) : pathname;
  return relative.replace(TRAILING_SLASHES, "") || "/";
};

/** True when the path (relative to the base path) is in {@link AUTH_HTTP_PATHS}. */
export const isAuthHttpPath = (path: string): boolean => ALLOWED_PATHS.has(path);

const notFound = (): Response => new Response("Not Found", { status: 404 });

/**
 * Better Auth plugin enforcing {@link AUTH_HTTP_PATHS}. `onRequest` runs only for HTTP requests
 * that reach `auth.handler`, before routing, so a blocked endpoint never executes.
 */
export const authHttpAllowlist = () =>
  ({
    id: "http-allowlist",
    onRequest: (request, context) =>
      Promise.resolve(
        isAuthHttpPath(toAuthPath(request.url, context.baseURL))
          ? undefined
          : { response: notFound() },
      ),
  }) satisfies BetterAuthPlugin;
