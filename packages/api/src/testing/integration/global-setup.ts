import type { TestProject } from "vitest/node";

import { applyMigrations, createDatabase, dropDatabase } from "./database-lifecycle";
import { databaseNameOf } from "./database-name";
import { parseIntegrationEnv } from "./env";

/**
 * Vitest `globalSetup` of the integration project (`vitest.integration.config.ts`).
 *
 * Runs once per `pnpm test:integration`, before any test file:
 *   1. creates the run's throwaway database (`INTEGRATION_DATABASE_URL`, computed by the config)
 *      on the server of `TEST_DATABASE_URL`;
 *   2. applies the real migrations of `@repo/db` (`prisma migrate deploy`);
 *   3. returns the teardown that drops the database when every file has finished.
 *
 * Without `TEST_DATABASE_URL` it does nothing and the suites skip themselves
 * (`describe.skipIf(!INTEGRATION_ENABLED)`). The config already fails in CI in that case.
 */
export async function setup(project: TestProject): Promise<() => Promise<void>> {
  const { TEST_DATABASE_URL: serverUrl, INTEGRATION_DATABASE_URL: databaseUrl } =
    parseIntegrationEnv(project.config.env);
  if (!serverUrl || !databaseUrl) {
    process.stderr.write(
      "\n[integration] TEST_DATABASE_URL no está definida: se omiten las pruebas de " +
        "integración. Ver docs/REPO_RULES.md §8.1 para ejecutarlas con el PostgreSQL de compose.\n\n",
    );
    return async () => {
      // Nothing was created.
    };
  }

  await createDatabase(serverUrl, databaseUrl);
  try {
    await applyMigrations(databaseUrl);
  } catch (error) {
    await dropDatabase(serverUrl, databaseUrl);
    throw error;
  }
  process.stderr.write(
    `\n[integration] Base de datos de prueba: ${databaseNameOf(databaseUrl)} (migrada)\n\n`,
  );
  return async () => {
    await dropDatabase(serverUrl, databaseUrl);
  };
}
