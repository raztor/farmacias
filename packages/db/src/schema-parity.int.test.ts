import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { DOMAIN_CHECK_LISTS, quotedLiterals } from "./testing/check-constraints";
import { TEST_DATABASE_URL } from "./testing/env";
import { createTestDatabase, type TestDatabase } from "./testing/test-database";

/**
 * Authoritative version of the parity check: reads each CHECK as PostgreSQL stores it after
 * running every migration (`pg_get_constraintdef`), so no SQL text parsing can hide a drift.
 */
describe.skipIf(!TEST_DATABASE_URL)("domain lists vs the migrated database (R-DAT-02)", () => {
  let testDb: TestDatabase | undefined;
  const definitions = new Map<string, string>();

  beforeAll(async () => {
    testDb = await createTestDatabase(TEST_DATABASE_URL ?? "");
    const rows = await testDb.db.$queryRaw<{ name: string; definition: string }[]>`
      SELECT conname AS name, pg_get_constraintdef(oid) AS definition
      FROM pg_constraint WHERE contype = 'c'`;
    for (const row of rows) definitions.set(row.name, row.definition);
  });

  afterAll(async () => {
    await testDb?.drop();
  });

  it.each(DOMAIN_CHECK_LISTS)(
    "$constraint accepts exactly the shared list",
    ({ constraint, values }) => {
      const definition = definitions.get(constraint);
      expect(definition, `${constraint} not found`).toBeDefined();
      expect(quotedLiterals(definition ?? "")).toEqual([...values]);
    },
  );
});
