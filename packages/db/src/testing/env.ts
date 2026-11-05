import { assertPostgresUrl } from "../database-url";

/**
 * Environment of the database integration tests (test-only module).
 *
 * `TEST_DATABASE_URL` points to a PostgreSQL server where the tests may create and drop their
 * own throwaway databases (e.g. `postgresql://app:app@localhost:5432/app`). When it is not set,
 * the integration tests are skipped.
 */
const rawUrl = process.env.TEST_DATABASE_URL?.trim();

export const TEST_DATABASE_URL: string | undefined = rawUrl ? assertPostgresUrl(rawUrl) : undefined;

/** Environment for the Prisma CLI child process, pointed at `databaseUrl`. */
export function prismaCliEnv(databaseUrl: string): NodeJS.ProcessEnv {
  return { ...process.env, DATABASE_URL: databaseUrl };
}
