/** Landing page of the backoffice after signing in. */
export const DEFAULT_AUTHENTICATED_PATH = "/";

export const SIGN_IN_PATH = "/sign-in";

/** Query parameter used to return to a protected page after signing in. */
export const REDIRECT_PARAM = "redirectTo";

/**
 * Only same-origin, absolute paths are accepted as redirect targets, preventing open redirects
 * such as `//evil.example` or `https://evil.example`.
 */
export function safeRedirectPath(
  value: string | null | undefined,
  fallback: string = DEFAULT_AUTHENTICATED_PATH,
): string {
  if (value === null || value === undefined) return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  return value;
}

/** `/sign-in?redirectTo=<path>` for a protected path (plain `/sign-in` for the home page). */
export function signInPathFor(pathname: string): string {
  if (pathname === DEFAULT_AUTHENTICATED_PATH) return SIGN_IN_PATH;
  return `${SIGN_IN_PATH}?${new URLSearchParams({ [REDIRECT_PARAM]: pathname }).toString()}`;
}
