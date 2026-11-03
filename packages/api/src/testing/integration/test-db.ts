import { createPrismaClient, type PrismaClient } from "@repo/db";

import { integrationEnv } from "./env";

/**
 * Prisma access for integration tests. Each test file runs in its own isolated module graph,
 * so every file gets its own client (disconnect it in `afterAll`).
 */

/** True when the run has a throwaway database (`TEST_DATABASE_URL` set). */
export const INTEGRATION_ENABLED: boolean = integrationEnv.INTEGRATION_DATABASE_URL !== undefined;

/** Message for `describe.skipIf` reporters and docs. */
export const INTEGRATION_SKIP_REASON =
  "TEST_DATABASE_URL no definida: pruebas de integración omitidas";

let client: PrismaClient | undefined;

/** URL of the run's throwaway database. Throws when integration tests are disabled. */
export function getIntegrationDatabaseUrl(): string {
  const url = integrationEnv.INTEGRATION_DATABASE_URL;
  if (!url) {
    throw new Error(`${INTEGRATION_SKIP_REASON}. Usa describe.skipIf(!INTEGRATION_ENABLED).`);
  }
  return url;
}

/** Shared Prisma client of the current test file, connected to the throwaway database. */
export function getTestDb(): PrismaClient {
  client ??= createPrismaClient({
    databaseUrl: getIntegrationDatabaseUrl(),
    // Not "error": tests provoke constraint violations on purpose; failures still show them.
    log: ["warn"],
  });
  return client;
}

/** Disconnects the client of the current test file (call it in `afterAll`). */
export async function disconnectTestDb(): Promise<void> {
  const current = client;
  client = undefined;
  await current?.$disconnect();
}

const quoteIdentifier = (name: string): string => `"${name.replaceAll('"', '""')}"`;

/**
 * Empties every table of the schema (except Prisma's migration history) and restarts every
 * sequence, so each test starts from the migrated, empty database:
 * `TRUNCATE ... RESTART IDENTITY CASCADE` plus `ALTER SEQUENCE ... RESTART` for standalone
 * sequences such as `order_code_seq` (codes start again at `P-000001`).
 *
 * Table names are read from the catalog, so new migrations need no change here.
 */
export async function resetDatabase(db: PrismaClient = getTestDb()): Promise<void> {
  const tables = await db.$queryRaw<{ name: string }[]>`
    SELECT tablename AS name FROM pg_tables
    WHERE schemaname = current_schema() AND tablename <> '_prisma_migrations'`;
  const sequences = await db.$queryRaw<{ name: string }[]>`
    SELECT sequencename AS name FROM pg_sequences WHERE schemaname = current_schema()`;
  if (tables.length > 0) {
    const list = tables.map((table) => quoteIdentifier(table.name)).join(", ");
    await db.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
  }
  for (const sequence of sequences) {
    await db.$executeRawUnsafe(`ALTER SEQUENCE ${quoteIdentifier(sequence.name)} RESTART`);
  }
}
