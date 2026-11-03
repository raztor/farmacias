import { APP_SCHEME, AUTH_COOKIE_PREFIX } from "@repo/shared";

/** Prefix of every Better Auth cookie (`bnp.session_token`, `bnp.session_data`…). */
export { AUTH_COOKIE_PREFIX };

/** Deep link origin of the mobile app. Always trusted so `@better-auth/expo` can sign in. */
export const MOBILE_TRUSTED_ORIGIN = `${APP_SCHEME}://`;

/** Minimum secret length accepted (Better Auth recommends 32+ random characters). */
export const AUTH_SECRET_MIN_LENGTH = 32;

const DAY_IN_SECONDS = 60 * 60 * 24;

/** Session lifetime policy (seconds). */
export const SESSION_POLICY = {
  /** Sessions expire after 30 days of inactivity. */
  expiresIn: 30 * DAY_IN_SECONDS,
  /** Expiration is extended at most once per day while the session is used. */
  updateAge: DAY_IN_SECONDS,
  /** Signed session cookie cache, avoids a DB read on every request for 5 minutes. */
  cookieCacheMaxAge: 5 * 60,
} as const;

/**
 * Better Auth model used by the database rate limiter. It must match the Prisma
 * client delegate (`prisma.rateLimit`), i.e. the `RateLimit` model of `@repo/db`.
 */
export const RATE_LIMIT_MODEL = "rateLimit";

/** Default rate limit window shared by every auth endpoint (100 requests per minute). */
export const RATE_LIMIT_RULE = { window: 60, max: 100 } as const;

/** Thrown when `createAuth` receives an invalid configuration. */
export class AuthConfigError extends Error {
  override readonly name = "AuthConfigError";
}

/** Validates the secret used to sign cookies and tokens. */
export function assertAuthSecret(secret: string): string {
  if (secret.trim().length < AUTH_SECRET_MIN_LENGTH) {
    throw new AuthConfigError(
      `Auth secret must be at least ${AUTH_SECRET_MIN_LENGTH} characters long.`,
    );
  }
  return secret;
}

/** Validates the public URL of the auth server and returns it without a trailing slash. */
export function normalizeBaseURL(baseURL: string): string {
  let url: URL;
  try {
    url = new URL(baseURL);
  } catch (error) {
    throw new AuthConfigError(`Auth baseURL is not a valid URL: "${baseURL}".`, { cause: error });
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new AuthConfigError(`Auth baseURL must use http or https: "${baseURL}".`);
  }
  return url.toString().replace(/\/+$/, "");
}

/**
 * Trims, de-duplicates and drops empty origins, and guarantees the mobile scheme
 * (`bnp://`) is trusted. Wildcards (`https://*.example.com`) are kept as-is.
 */
export function normalizeTrustedOrigins(origins: readonly string[]): string[] {
  const unique = new Set<string>();
  for (const origin of origins) {
    const trimmed = origin.trim();
    if (trimmed.length > 0) {
      unique.add(trimmed);
    }
  }
  unique.add(MOBILE_TRUSTED_ORIGIN);
  return [...unique];
}
