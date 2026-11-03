/** Human-readable product name, shown in UI titles and email templates. */
export const APP_NAME = "Farmacia Comunitaria Peñalolén";

/** Deep link scheme used by the mobile app (`bnp://`) and trusted by the auth server. */
export const APP_SCHEME = "bnp";

/**
 * Prefix of every Better Auth cookie (`bnp.session_token`, `__Secure-bnp.session_token` in
 * production). Shared by the API (`advanced.cookiePrefix`), the Next.js proxies that detect the
 * session cookie and the Expo client that stores it.
 */
export const AUTH_COOKIE_PREFIX = APP_SCHEME;
