import { createHash } from "node:crypto";

import type { BetterAuthPlugin, DBAdapter } from "better-auth";
import { getIP } from "better-auth/api";

import { RATE_LIMIT_MODEL } from "./auth-config";
import { toAuthPath } from "./http-allowlist";
import { readRequestBody, signInEmailOf } from "./sign-in-body";

/**
 * Sign-in attempts allowed per ACCOUNT (email) and client IP: 10 every 15 minutes (R-ACC-09).
 * Better Auth's own limit (3 per 10 s per IP, any account) stops bursts; this one stops slow
 * guessing of one account. It is keyed by IP too so that someone else's failed attempts never
 * lock the owner out from their own network: the client IP is trustworthy because the server
 * replaces `X-Forwarded-For` with the IP resolved from trusted proxies (`TRUST_PROXY_ADDRESSES`).
 */
export const SIGN_IN_ACCOUNT_RULE = { window: 900, max: 10 } as const;

const SIGN_IN_PATH = "/sign-in/email";
const KEY_PREFIX = "sign-in-account:";
/** Bucket shared by requests without a resolvable client IP (never the case behind the server). */
const UNKNOWN_IP = "unknown";
const MAX_RACE_RETRIES = 3;
const MS_PER_SECOND = 1000;
const TOO_MANY_REQUESTS = 429;
const BAD_REQUEST = 400;

type RateLimitRule = { window: number; max: number };
type CounterRow = { key: string; count: number; lastRequest: number | bigint | string };
type CounterAdapter = Pick<DBAdapter, "findMany" | "create" | "incrementOne">;
export type ConsumeResult = { allowed: true } | { allowed: false; retryAfter: number };

/**
 * Rate-limit key of an account seen from a client IP: a hash, so the `rate_limit` table never
 * stores emails nor IPs. The pair is JSON-encoded so no email/IP combination can collide.
 */
export const signInAccountKey = (email: string, ip: string): string =>
  `${KEY_PREFIX}${createHash("sha256")
    .update(JSON.stringify([email, ip]))
    .digest("hex")}`;

const readCounter = async (adapter: CounterAdapter, key: string) => {
  const [row] = await adapter.findMany<CounterRow>({
    model: RATE_LIMIT_MODEL,
    where: [{ field: "key", value: key }],
  });
  return row === undefined ? undefined : { ...row, lastRequest: Number(row.lastRequest) };
};

const createCounter = async (adapter: CounterAdapter, key: string, now: number) => {
  try {
    await adapter.create({ model: RATE_LIMIT_MODEL, data: { key, count: 1, lastRequest: now } });
    return true;
  } catch (error) {
    // Lost the race against a concurrent first attempt: the row exists now, retry with it.
    if ((await readCounter(adapter, key)) === undefined) throw error;
    return false;
  }
};

/** Starts a new window, guarded by the stale `lastRequest` so concurrent resets count once. */
const resetCounter = async (adapter: CounterAdapter, key: string, stale: number, now: number) =>
  (await adapter.incrementOne({
    model: RATE_LIMIT_MODEL,
    where: [
      { field: "key", value: key },
      { field: "lastRequest", operator: "lte", value: stale },
    ],
    increment: {},
    set: { count: 1, lastRequest: now },
  })) !== null;

/** Counts one attempt inside the current window, guarded by `count < max` (atomic). */
const incrementCounter = async (
  adapter: CounterAdapter,
  key: string,
  rule: RateLimitRule,
  now: number,
) =>
  (await adapter.incrementOne({
    model: RATE_LIMIT_MODEL,
    where: [
      { field: "key", value: key },
      { field: "lastRequest", operator: "gt", value: now - rule.window * MS_PER_SECOND },
      { field: "count", operator: "lt", value: rule.max },
    ],
    increment: { count: 1 },
    set: { lastRequest: now },
  })) !== null;

/**
 * Atomically counts one attempt for `key` (same semantics as Better Auth's database limiter:
 * the window restarts once `window` seconds pass without an allowed attempt). Every write is a
 * guarded single-row update, so concurrent attempts can never all pass a stale read.
 */
export const consumeAttempt = async (
  adapter: CounterAdapter,
  key: string,
  rule: RateLimitRule,
  now: number = Date.now(),
): Promise<ConsumeResult> => {
  for (let attempt = 0; attempt < MAX_RACE_RETRIES; attempt += 1) {
    if (await incrementCounter(adapter, key, rule, now)) return { allowed: true };
    const row = await readCounter(adapter, key);
    const windowMs = rule.window * MS_PER_SECOND;
    if (row === undefined) {
      if (await createCounter(adapter, key, now)) return { allowed: true };
    } else if (now - row.lastRequest >= windowMs) {
      if (await resetCounter(adapter, key, row.lastRequest, now)) return { allowed: true };
    } else if (row.count >= rule.max) {
      return {
        allowed: false,
        retryAfter: Math.ceil((row.lastRequest + windowMs - now) / MS_PER_SECOND),
      };
    }
  }
  throw new Error("Sign-in rate limit: too much contention on the same account");
};

const tooManyRequests = (retryAfter: number): Response =>
  new Response(JSON.stringify({ message: "Too many requests. Please try again later." }), {
    status: TOO_MANY_REQUESTS,
    headers: { "content-type": "application/json", "x-retry-after": String(retryAfter) },
  });

/** Same answer Better Auth gives to an invalid email (`BASE_ERROR_CODES.INVALID_EMAIL`). */
const invalidEmail = (): Response =>
  new Response(JSON.stringify({ code: "INVALID_EMAIL", message: "Invalid email" }), {
    status: BAD_REQUEST,
    headers: { "content-type": "application/json" },
  });

/**
 * Better Auth plugin limiting `POST /sign-in/email` per account and client IP, stored in the same
 * database table as Better Auth's limiter. Active only when Better Auth's rate limiting is
 * (production). It fails closed: a sign-in whose email cannot be read in a body format Better Auth
 * accepts (JSON, urlencoded) is answered 400 here, so no request can skip the count.
 */
export const signInAccountLimit = (rule: RateLimitRule = SIGN_IN_ACCOUNT_RULE) =>
  ({
    id: "sign-in-account-limit",
    // Never matches a request: it only makes Better Auth's row pruning keep counters for the
    // whole window (it deletes rows older than the longest window it knows about).
    rateLimit: [{ window: rule.window, max: rule.max, pathMatcher: () => false }],
    onRequest: async (request, context) => {
      if (!context.rateLimit.enabled || request.method !== "POST") return;
      if (toAuthPath(request.url, context.baseURL) !== SIGN_IN_PATH) return;
      const email = signInEmailOf(await readRequestBody(request));
      if (email === null) return { response: invalidEmail() };
      const ip = getIP(request, context.options) ?? UNKNOWN_IP;
      const result = await consumeAttempt(context.adapter, signInAccountKey(email, ip), rule);
      return result.allowed ? undefined : { response: tooManyRequests(result.retryAfter) };
    },
  }) satisfies BetterAuthPlugin;
