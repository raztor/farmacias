import { defineConfig } from "vitest/config";

/**
 * Integration tests on a real PostgreSQL (`*.int.test.ts`): `pnpm test:integration`.
 *
 * - `TEST_DATABASE_URL` (admin connection, e.g. the compose PostgreSQL
 *   `postgresql://app:app@localhost:5432/app`) is the server where each suite creates its own
 *   throwaway database (`src/testing/test-database.ts`), migrates it with the real migrations and
 *   drops it at the end.
 * - Without `TEST_DATABASE_URL` the suites are skipped with a message, except in CI where the
 *   run fails: CI must never report a green integration job that tested nothing.
 * - Files run one at a time to keep the load on the shared server predictable.
 */
const serverUrl = process.env.TEST_DATABASE_URL?.trim() ?? "";

if (!serverUrl && process.env.CI) {
  throw new Error("TEST_DATABASE_URL es obligatoria en CI para las pruebas de integración.");
}

if (!serverUrl) {
  process.stderr.write(
    "\n[integration] TEST_DATABASE_URL no está definida: se omiten las pruebas de integración " +
      "de @repo/db. Ver docs/REPO_RULES.md §8.1 para ejecutarlas con el PostgreSQL de compose.\n\n",
  );
}

export default defineConfig({
  test: {
    name: "integration",
    include: ["src/**/*.int.test.ts"],
    fileParallelism: false,
    maxWorkers: 1,
    sequence: { concurrent: false },
    testTimeout: 30_000,
    hookTimeout: 60_000,
    restoreMocks: true,
  },
});
