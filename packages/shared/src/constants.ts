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

/** User roles. `admin` unlocks the backoffice and `adminProcedure` endpoints. */
export const ROLES = {
  user: "user",
  admin: "admin",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

/** Every role as a tuple, handy for `z.enum(ROLE_VALUES)` and exhaustive iteration. */
export const ROLE_VALUES = [ROLES.user, ROLES.admin] as const satisfies readonly Role[];

/** Type guard for values coming from untyped sources (database rows, session payloads). */
export const isRole = (value: unknown): value is Role =>
  typeof value === "string" && (ROLE_VALUES as readonly string[]).includes(value);
