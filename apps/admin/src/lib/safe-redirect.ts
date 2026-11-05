/** Landing page of the backoffice after signing in. */
export const DEFAULT_AUTHENTICATED_PATH = "/";

export const SIGN_IN_PATH = "/sign-in";

/** Query parameter used to return to a protected page after signing in. */
export const REDIRECT_PARAM = "redirectTo";

/** Placeholder origin used only to resolve a candidate path the way the browser would. */
const PROBE_ORIGIN = "http://redirect.invalid";

/**
 * `true` when the value has an ASCII control character (U+0000–U+001F, U+007F). The URL parser
 * strips tab/CR/LF, so `/\t/evil.example` would otherwise become `//evil.example`.
 */
const hasControlCharacter = (value: string): boolean =>
  Array.from(value).some((char) => {
    const code = char.charCodeAt(0);
    return code <= 0x1f || code === 0x7f;
  });

/** Absolute path that a browser can only resolve on the current origin (no `//`, `\\`, controls). */
const isSameOriginPath = (value: string): boolean =>
  value.startsWith("/") &&
  !value.startsWith("//") &&
  !value.includes("\\") &&
  !hasControlCharacter(value);

/**
 * Only same-origin, absolute paths are accepted as redirect targets, preventing open redirects
 * such as `//evil.example`, `https://evil.example` or `/\t/evil.example`. The candidate is
 * resolved like the browser (and Next's router) would resolve it and must stay on this origin;
 * the normalized path, query and hash are returned only if they still pass the same checks.
 */
export function safeRedirectPath(
  value: string | null | undefined,
  fallback: string = DEFAULT_AUTHENTICATED_PATH,
): string {
  if (value === null || value === undefined || !isSameOriginPath(value)) return fallback;
  const url = URL.parse(value, PROBE_ORIGIN);
  if (url?.origin !== PROBE_ORIGIN) return fallback;
  const normalized = `${url.pathname}${url.search}${url.hash}`;
  // Dot-segment removal can turn a valid path into a protocol-relative one
  // (`/.//evil.example` → `//evil.example`): the result must pass the same checks again.
  return isSameOriginPath(normalized) ? normalized : fallback;
}

/** `/sign-in?redirectTo=<path>` for a protected path (plain `/sign-in` for the home page). */
export function signInPathFor(pathname: string): string {
  if (pathname === DEFAULT_AUTHENTICATED_PATH) return SIGN_IN_PATH;
  return `${SIGN_IN_PATH}?${new URLSearchParams({ [REDIRECT_PARAM]: pathname }).toString()}`;
}
