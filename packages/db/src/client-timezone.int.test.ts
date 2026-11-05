import { describe, expect, it } from "vitest";

import { createPrismaClient } from "./client";
import { TEST_DATABASE_URL } from "./testing/env";
import { createTestDatabase } from "./testing/test-database";

const MAX_CLOCK_SKEW_MS = 60_000;

describe.skipIf(!TEST_DATABASE_URL)("Prisma session time zone", () => {
  it("runs in UTC whatever the database time zone", async () => {
    const testDb = await createTestDatabase(TEST_DATABASE_URL ?? "");
    const name = new URL(testDb.url).pathname.slice(1);
    await testDb.db.$executeRawUnsafe(
      `ALTER DATABASE "${name}" SET timezone TO 'America/Santiago'`,
    );
    const db = createPrismaClient({ databaseUrl: testDb.url });
    try {
      const rows = await db.$queryRaw<{ tz: string; now: Date }[]>`
        SELECT current_setting('TimeZone') AS tz, now() AS now`;
      const row = rows.at(0);
      expect(row?.tz).toBe("UTC");
      const skew = Math.abs((row?.now.getTime() ?? 0) - Date.now());
      expect(skew, `now() differs from the client clock by ${String(skew)} ms`).toBeLessThan(
        MAX_CLOCK_SKEW_MS,
      );
    } finally {
      await db.$disconnect();
      await testDb.drop();
    }
  });
});
