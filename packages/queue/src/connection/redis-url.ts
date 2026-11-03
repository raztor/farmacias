import type { RedisOptions } from "bullmq";
import { z } from "zod";

const DEFAULT_REDIS_PORT = 6379;
const MAX_REDIS_DB_INDEX = 65_535;

/**
 * How the connection is used:
 * - `producer`: enqueues from request handlers, so it fails fast while Redis is down
 *   instead of buffering commands in memory (BullMQ's production recommendation).
 * - `worker`: long-lived blocking connection; BullMQ requires `maxRetriesPerRequest: null`.
 */
export type ConnectionRole = "producer" | "worker";

/** Connection options derived from a `REDIS_URL`, accepted by BullMQ's `connection`. */
export type RedisConnectionOptions = RedisOptions & {
  host: string;
  port: number;
  db: number;
  username?: string;
  password?: string;
  tls?: Record<string, never>;
  maxRetriesPerRequest: number | null;
  enableOfflineQueue: boolean;
};

const PRODUCER_MAX_RETRIES_PER_REQUEST = 3;

const redisUrlSchema = z.url({
  protocol: /^rediss?$/,
  error: "Expected a redis:// or rediss:// URL",
});

const dbIndexSchema = z.coerce
  .number({ error: "Database index must be a number" })
  .int({ error: "Database index must be an integer" })
  .min(0, { error: "Database index must be >= 0" })
  .max(MAX_REDIS_DB_INDEX, { error: "Database index is too large" });

const formatIssues = (error: z.ZodError): string =>
  error.issues.map((issue) => issue.message).join("; ");

/** Throws without echoing the URL: it usually contains the Redis password. */
const invalid = (reason: string): never => {
  throw new Error(`Invalid Redis URL: ${reason}`);
};

const parseDbIndex = (pathname: string): number => {
  const segment = pathname.replace(/^\//, "");
  if (segment === "") return 0;
  const result = dbIndexSchema.safeParse(segment);
  return result.success ? result.data : invalid(formatIssues(result.error));
};

const decodeCredential = (value: string): string | undefined => {
  if (value === "") return undefined;
  try {
    return decodeURIComponent(value);
  } catch {
    return invalid("credentials are not correctly percent-encoded");
  }
};

const roleOptions = (
  role: ConnectionRole,
): Pick<RedisConnectionOptions, "maxRetriesPerRequest" | "enableOfflineQueue"> =>
  role === "worker"
    ? { maxRetriesPerRequest: null, enableOfflineQueue: true }
    : { maxRetriesPerRequest: PRODUCER_MAX_RETRIES_PER_REQUEST, enableOfflineQueue: false };

/**
 * Parses `redis[s]://[[username][:password]@]host[:port][/db]` into connection options.
 * `rediss://` enables TLS (SNI defaults to the host name).
 */
export const parseRedisUrl = (
  redisUrl: string,
  role: ConnectionRole = "producer",
): RedisConnectionOptions => {
  const result = redisUrlSchema.safeParse(redisUrl.trim());
  if (!result.success) return invalid(formatIssues(result.error));

  const url = new URL(result.data);
  const host = url.hostname.replace(/^\[(.*)\]$/, "$1");
  if (host === "") return invalid("missing host");

  const username = decodeCredential(url.username);
  const password = decodeCredential(url.password);

  return {
    host,
    port: url.port === "" ? DEFAULT_REDIS_PORT : Number(url.port),
    db: parseDbIndex(url.pathname),
    ...(username === undefined ? {} : { username }),
    ...(password === undefined ? {} : { password }),
    ...(url.protocol === "rediss:" ? { tls: {} } : {}),
    ...roleOptions(role),
  };
};

/** Log-safe description of a connection (never includes credentials). */
export const describeConnection = (
  options: RedisConnectionOptions,
): { host: string; port: number; db: number; tls: boolean } => ({
  host: options.host,
  port: options.port,
  db: options.db,
  tls: options.tls !== undefined,
});
