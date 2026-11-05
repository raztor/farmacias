const POSTGRES_PROTOCOLS = new Set(["postgres:", "postgresql:"]);

/**
 * Error raised when the database connection string is missing or malformed.
 * The message never includes the URL itself, since it usually carries credentials.
 */
export class InvalidDatabaseUrlError extends Error {
  override readonly name = "InvalidDatabaseUrlError";

  constructor(reason: string) {
    super(`Invalid database URL: ${reason}`);
  }
}

/**
 * Checks that `value` is a PostgreSQL connection string (`postgres://` or `postgresql://`)
 * and returns it trimmed. Throws `InvalidDatabaseUrlError` otherwise.
 */
export function assertPostgresUrl(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new InvalidDatabaseUrlError("the value is empty.");
  }
  if (!URL.canParse(trimmed)) {
    throw new InvalidDatabaseUrlError("the value is not a valid URL.");
  }
  const { protocol, hostname } = new URL(trimmed);
  if (!POSTGRES_PROTOCOLS.has(protocol)) {
    throw new InvalidDatabaseUrlError('expected the "postgres://" or "postgresql://" protocol.');
  }
  if (hostname.length === 0) {
    throw new InvalidDatabaseUrlError("the host is missing.");
  }
  return trimmed;
}
