import type { PrismaClient } from "@repo/db";
import { describe, expect, it } from "vitest";

import { createAuth } from "./create-auth";
import {
  consumeAttempt,
  SIGN_IN_ACCOUNT_RULE,
  signInAccountKey,
  signInAccountLimit,
} from "./sign-in-account-limit";
import { signInEmailOf } from "./sign-in-body";
import { createMemoryAuth } from "./testing/memory-auth";

const RULE = { window: 60, max: 3 };

/** Adapter of a memory-backed Better Auth instance (same factory as the Prisma one). */
const memoryAdapter = async () => (await createMemoryAuth().auth.$context).adapter;

type Row = { key: string; count: number; lastRequest: number };
type Condition = { field: string; operator?: string; value: unknown };

const matches = (row: Row, condition: Condition): boolean => {
  const actual = row[condition.field as keyof Row];
  const expected = condition.value as number | string;
  if (condition.operator === "gt") return actual > expected;
  if (condition.operator === "lt") return actual < expected;
  if (condition.operator === "lte") return actual <= expected;
  return actual === expected;
};

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

/**
 * What PostgreSQL guarantees to the limiter and the memory adapter does not: a UNIQUE `key`
 * (concurrent first attempts cannot all insert) and atomic guarded single-row updates. Every
 * call yields first, so concurrent attempts interleave between the read and the write.
 */
const uniqueKeyStore = () => {
  const rows = new Map<string, Row>();
  const find = (where: Condition[]) =>
    [...rows.values()].filter((row) => where.every((c) => matches(row, c)));
  return {
    findMany: async ({ where }: { where: Condition[] }) => (await tick(), find(where)),
    create: async ({ data }: { data: Row }) => {
      await tick();
      if (rows.has(data.key)) throw new Error("duplicate key value violates unique constraint");
      rows.set(data.key, { ...data });
      return data;
    },
    incrementOne: async (input: {
      where: Condition[];
      increment: Record<string, number>;
      set?: Partial<Row>;
    }) => {
      await tick();
      const [row] = find(input.where);
      if (row === undefined) return null;
      Object.assign(row, input.set, { count: row.count + (input.increment.count ?? 0) });
      return row;
    },
  } as unknown as Parameters<typeof consumeAttempt>[0];
};

describe("signInEmailOf / signInAccountKey", () => {
  it("normalizes the email like Better Auth and ignores bodies it would reject", () => {
    expect(signInEmailOf({ email: "  Ana@Demo.Farmacia.CL ", password: "x" })).toBe(
      "ana@demo.farmacia.cl",
    );
    expect(signInEmailOf({ email: "no-es-correo" })).toBeNull();
    expect(signInEmailOf({ email: 42 })).toBeNull();
    expect(signInEmailOf(null)).toBeNull();
  });

  it("hashes the email and IP so the rate_limit table never stores them", () => {
    const key = signInAccountKey("ana@demo.farmacia.cl", "198.51.100.7");

    expect(key).toMatch(/^sign-in-account:[0-9a-f]{64}$/);
    expect(key).not.toContain("ana");
    expect(key).not.toContain("198.51");
  });

  it("keeps one key per account and IP pair", () => {
    const key = signInAccountKey("ana@demo.farmacia.cl", "198.51.100.7");

    expect(signInAccountKey("ana@demo.farmacia.cl", "198.51.100.8")).not.toBe(key);
    expect(signInAccountKey("otra@demo.farmacia.cl", "198.51.100.7")).not.toBe(key);
  });
});

describe("consumeAttempt", () => {
  it("allows `max` attempts per window and then reports when to retry", async () => {
    const adapter = await memoryAdapter();
    const now = 1_000_000;
    const results = [];
    for (let attempt = 0; attempt < 4; attempt += 1) {
      results.push(await consumeAttempt(adapter, "k", RULE, now + attempt * 1000));
    }

    expect(results.map((result) => result.allowed)).toEqual([true, true, true, false]);
    // Window counted from the last allowed attempt (now + 2 s), blocked at now + 3 s.
    expect(results[3]).toEqual({ allowed: false, retryAfter: 59 });
  });

  it("starts a new window once `window` seconds pass", async () => {
    const adapter = await memoryAdapter();
    for (let attempt = 0; attempt < 3; attempt += 1) await consumeAttempt(adapter, "k", RULE, 0);

    await expect(consumeAttempt(adapter, "k", RULE, 59_999)).resolves.toMatchObject({
      allowed: false,
    });
    await expect(consumeAttempt(adapter, "k", RULE, 60_000)).resolves.toEqual({ allowed: true });
  });

  it("never lets concurrent attempts exceed `max`", async () => {
    const adapter = uniqueKeyStore();

    const results = await Promise.all(
      Array.from({ length: 10 }, () => consumeAttempt(adapter, "k", RULE, 5000)),
    );

    expect(results.filter((result) => result.allowed)).toHaveLength(RULE.max);
  });

  it("keeps separate counters per key", async () => {
    const adapter = await memoryAdapter();
    for (let attempt = 0; attempt < 3; attempt += 1) await consumeAttempt(adapter, "a", RULE, 0);

    await expect(consumeAttempt(adapter, "b", RULE, 0)).resolves.toEqual({ allowed: true });
  });
});

describe("createAuth", () => {
  it("registers the HTTP allowlist and the per-account limit before the other plugins", () => {
    const auth = createAuth({
      db: {} as PrismaClient,
      secret: "test-secret-with-at-least-32-characters!!",
      baseURL: "http://localhost:4000",
      trustedOrigins: [],
      isProduction: true,
    });
    const [pruningRule] = signInAccountLimit().rateLimit;

    expect(auth.options.plugins.slice(0, 2).map((plugin) => plugin.id)).toEqual([
      "http-allowlist",
      "sign-in-account-limit",
    ]);
    // Declares its window so Better Auth's pruning keeps the counters for 15 minutes.
    expect(pruningRule).toMatchObject(SIGN_IN_ACCOUNT_RULE);
    expect(pruningRule?.pathMatcher()).toBe(false);
  });
});
