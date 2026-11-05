import { readFileSync } from "node:fs";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { PrismaClient } from "./generated/prisma/client";
import { TEST_DATABASE_URL } from "./testing/env";
import { createTestDatabase, type TestDatabase } from "./testing/test-database";

const AUTH_MIGRATION = new URL(
  "../prisma/migrations/20261104120000_auth_timestamptz/migration.sql",
  import.meta.url,
);
const HOUR_MS = 3_600_000;

/** The ALTER statements of the auth migration (comments dropped). */
const authMigrationStatements = (): string[] =>
  readFileSync(AUTH_MIGRATION, "utf8")
    .split("\n")
    .filter((line) => !line.startsWith("--"))
    .join("\n")
    .split(";")
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);

/** Inverse of the migration: back to `timestamp(3)` holding UTC wall-clock values. */
const toNaiveUtc = (statement: string): string =>
  statement.replace(
    /SET DATA TYPE TIMESTAMPTZ\(3\) USING ("[a-z_]+") AT TIME ZONE 'UTC'/g,
    "SET DATA TYPE TIMESTAMP(3) USING $1 AT TIME ZONE 'UTC'",
  );

/** R-DAT-01 / D-23: every date column, Better Auth tables included, is `timestamptz(3)`. */
describe.skipIf(!TEST_DATABASE_URL)("timestamp columns on PostgreSQL", () => {
  let testDb: TestDatabase | undefined;
  let db: PrismaClient;

  beforeAll(async () => {
    testDb = await createTestDatabase(TEST_DATABASE_URL ?? "");
    db = testDb.db;
  });

  afterAll(async () => {
    await testDb?.drop();
  });

  it("stores every date of the schema as timestamptz(3)", async () => {
    const naive = await db.$queryRaw<{ column: string }[]>`
      SELECT table_name || '.' || column_name AS column
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name <> '_prisma_migrations'
        AND data_type LIKE 'timestamp%'
        AND (data_type <> 'timestamp with time zone' OR datetime_precision <> 3)`;
    expect(naive).toEqual([]);
  });

  it("compares session expiry with now() correctly in a Chile time zone session", async () => {
    await db.user.create({
      data: { id: "auth-user", name: "Residente", email: "auth-user@demo.farmacia.cl" },
    });
    await db.session.create({
      data: {
        id: "auth-session",
        token: "synthetic-token",
        userId: "auth-user",
        expiresAt: new Date(Date.now() + HOUR_MS),
      },
    });
    const [row] = await db
      .$transaction([
        db.$executeRaw`SET LOCAL timezone TO 'America/Santiago'`,
        db.$queryRaw<{ active: boolean; withinTwoHours: boolean }[]>`
        SELECT expires_at > now() AS active,
               expires_at < now() + interval '2 hours' AS "withinTwoHours"
        FROM session WHERE id = 'auth-session'`,
      ])
      .then(([, rows]) => rows);
    expect(row).toEqual({ active: true, withinTwoHours: true });
  });

  it("the migration keeps existing UTC values whatever the session time zone", async () => {
    const statements = authMigrationStatements();
    expect(statements).toHaveLength(4);
    // Every conversion must carry the explicit `USING ... AT TIME ZONE 'UTC'` (a plain cast would
    // read the values in the session time zone and shift them).
    for (const statement of statements) expect(toNaiveUtc(statement)).not.toBe(statement);
    const stored = new Date("2026-11-04T12:00:00.000Z");
    await db.verification.create({
      data: { id: "auth-verification", identifier: "x", value: "y", expiresAt: stored },
    });
    await db.$transaction(async (tx) => {
      for (const statement of statements) await tx.$executeRawUnsafe(toNaiveUtc(statement));
      await tx.$executeRaw`SET LOCAL timezone TO 'America/Santiago'`;
      for (const statement of statements) await tx.$executeRawUnsafe(statement);
    });
    const after = await db.verification.findUniqueOrThrow({ where: { id: "auth-verification" } });
    expect(after.expiresAt.toISOString()).toBe(stored.toISOString());
  });
});
