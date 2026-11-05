import { randomBytes } from "node:crypto";

import { defineConfig } from "vitest/config";

import {
  createIntegrationDatabaseName,
  withDatabaseName,
} from "./src/testing/integration/database-name";

/**
 * Integration tests on a real PostgreSQL (`*.int.test.ts`): `pnpm test:integration`.
 *
 * - `TEST_DATABASE_URL` (admin connection, e.g. the compose PostgreSQL
 *   `postgresql://app:app@localhost:5432/app`) is where each run creates its own throwaway
 *   database; `src/testing/integration/global-setup.ts` migrates it and drops it at the end.
 * - Without `TEST_DATABASE_URL` the suites are skipped with a message, except in CI where the
 *   run fails: CI must never report a green integration job that tested nothing.
 * - Files run one at a time (shared database, `resetDatabase()` between tests).
 */
const serverUrl = process.env.TEST_DATABASE_URL?.trim() ?? "";

if (!serverUrl && process.env.CI) {
  throw new Error("TEST_DATABASE_URL es obligatoria en CI para las pruebas de integración.");
}

const env: Record<string, string> = serverUrl
  ? {
      TEST_DATABASE_URL: serverUrl,
      INTEGRATION_DATABASE_URL: withDatabaseName(
        serverUrl,
        createIntegrationDatabaseName(Date.now(), randomBytes(4).toString("hex")),
      ),
    }
  : {};

export default defineConfig({
  test: {
    name: "integration",
    include: ["src/**/*.int.test.ts"],
    globalSetup: ["./src/testing/integration/global-setup.ts"],
    env,
    fileParallelism: false,
    maxWorkers: 1,
    sequence: { concurrent: false },
    testTimeout: 30_000,
    hookTimeout: 60_000,
    restoreMocks: true,
  },
});
