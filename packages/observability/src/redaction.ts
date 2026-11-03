/** Value written in place of redacted fields. */
export const REDACTED = "[REDACTED]";

/**
 * Keys redacted wherever they appear up to {@link MAX_DEPTH} levels deep: credential-bearing HTTP
 * headers (`req.headers.authorization`, `res.headers["set-cookie"]`...) and secret-like fields.
 */
const SENSITIVE_KEYS = [
  "authorization",
  "proxy-authorization",
  "cookie",
  "set-cookie",
  "password",
  "newPassword",
  "currentPassword",
  "token",
  "accessToken",
  "refreshToken",
  "idToken",
  "secret",
  "clientSecret",
  "apiKey",
] as const;

/**
 * Nesting levels covered with leading wildcards (`key`, `*.key`, `*.*.key`...). pino compiles the
 * paths once; each extra level adds a small per-log cost, and 5 levels cover shapes such as
 * `{ ctx: { input: { user: { credentials: { password } } } } }`.
 */
const MAX_DEPTH = 5;

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

const pathsFor = (key: string): string[] => {
  const paths: string[] = [];
  for (let depth = 0; depth <= MAX_DEPTH; depth += 1) {
    const prefix = Array.from({ length: depth }, () => "*").join(".");
    if (IDENTIFIER.test(key)) {
      paths.push(prefix.length > 0 ? `${prefix}.${key}` : key);
    } else {
      paths.push(`${prefix}["${key}"]`);
    }
  }
  return paths;
};

/** pino `redact.paths` for credentials in headers and secret-like fields at any common depth. */
export const REDACT_PATHS: readonly string[] = SENSITIVE_KEYS.flatMap(pathsFor);
