/** Where to go after signing in when no (valid) destination was requested. */
export const DEFAULT_REDIRECT = "/";

const MAX_REDIRECT_LENGTH = 200;
const SIGN_IN_PATH = "/sign-in";
const FIRST_PRINTABLE_CODE = 0x20;

const hasControlCharacters = (text: string): boolean =>
  Array.from(text).some((character) => (character.codePointAt(0) ?? 0) < FIRST_PRINTABLE_CODE);

/**
 * Validates the `redirect` search param of the sign-in screen. Only same-app absolute paths
 * are accepted (`/product/abc`), never other origins (`//evil.com`, `https://…`, `/\evil`) or the
 * sign-in screen itself, so the param cannot be abused as an open redirect. Pure.
 */
export function safeRedirect(value: unknown): string {
  const candidate = Array.isArray(value) ? (value[0] as unknown) : value;
  if (typeof candidate !== "string" || hasControlCharacters(candidate)) return DEFAULT_REDIRECT;
  const path = candidate.trim();
  if (path.length === 0 || path.length > MAX_REDIRECT_LENGTH) return DEFAULT_REDIRECT;
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) {
    return DEFAULT_REDIRECT;
  }
  if (path.includes("://")) return DEFAULT_REDIRECT;
  if (path === SIGN_IN_PATH || path.startsWith(`${SIGN_IN_PATH}?`)) return DEFAULT_REDIRECT;
  return path;
}

/** Sign-in route that comes back to `returnTo` afterwards. */
export function signInHref(returnTo: string): string {
  return `${SIGN_IN_PATH}?redirect=${encodeURIComponent(safeRedirect(returnTo))}`;
}
