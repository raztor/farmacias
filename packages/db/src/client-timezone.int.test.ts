import assert from "node:assert/strict";
import { test } from "node:test";

import { createPrismaClient } from "./client";
import { TEST_DATABASE_URL } from "./testing/env";
import { createTestDatabase } from "./testing/test-database";

const skip = TEST_DATABASE_URL ? false : "TEST_DATABASE_URL no definida";

const MAX_CLOCK_SKEW_MS = 60_000;

await test("Prisma sessions run in UTC whatever the database time zone", { skip }, async () => {
  if (!TEST_DATABASE_URL) return;
  const testDb = await createTestDatabase(TEST_DATABASE_URL);
  const name = new URL(testDb.url).pathname.slice(1);
  await testDb.db.$executeRawUnsafe(`ALTER DATABASE "${name}" SET timezone TO 'America/Santiago'`);
  const db = createPrismaClient({ databaseUrl: testDb.url });
  try {
    const rows = await db.$queryRaw<{ tz: string; now: Date }[]>`
      SELECT current_setting('TimeZone') AS tz, now() AS now`;
    const row = rows.at(0);
    assert.ok(row, "the query returned no row");
    assert.equal(row.tz, "UTC");
    const skew = Math.abs(row.now.getTime() - Date.now());
    assert.ok(
      skew < MAX_CLOCK_SKEW_MS,
      `now() differs from the client clock by ${String(skew)} ms`,
    );
  } finally {
    await db.$disconnect();
    await testDb.drop();
  }
});
