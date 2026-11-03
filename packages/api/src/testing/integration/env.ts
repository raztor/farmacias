import { assertPostgresUrl } from "@repo/db";
import { createEnv, type EnvSource } from "@repo/shared";
import { z } from "zod";

/**
 * Environment of the integration tests (test-only module).
 *
 * - `TEST_DATABASE_URL`: PostgreSQL server where the harness may create and drop databases
 *   (admin connection, e.g. `postgresql://app:app@localhost:5432/app`). Unset ⇒ the
 *   integration tests are skipped.
 * - `INTEGRATION_DATABASE_URL`: the throwaway database of the current run. It is computed by
 *   `vitest.integration.config.ts` and handed to the test workers through `test.env`; never
 *   set it by hand.
 */
const postgresUrl = z
  .string()
  .trim()
  .transform((value, ctx) => {
    try {
      return assertPostgresUrl(value);
    } catch (error) {
      ctx.addIssue({ code: "custom", message: error instanceof Error ? error.message : "invalid" });
      return z.NEVER;
    }
  });

export const integrationEnvSchema = z.object({
  TEST_DATABASE_URL: postgresUrl.optional(),
  INTEGRATION_DATABASE_URL: postgresUrl.optional(),
});

export type IntegrationEnv = z.output<typeof integrationEnvSchema>;

export const parseIntegrationEnv = (source: EnvSource): IntegrationEnv =>
  createEnv(integrationEnvSchema, source);

export const integrationEnv: IntegrationEnv = parseIntegrationEnv(process.env);

/** Environment for a child process (the Prisma CLI): the current one plus `overrides`. */
export const childProcessEnv = (
  overrides: Readonly<Record<string, string>>,
): Record<string, string | undefined> => ({ ...process.env, ...overrides });
