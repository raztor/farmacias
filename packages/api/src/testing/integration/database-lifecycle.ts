import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { createPrismaClient } from "@repo/db";

import { DB_PACKAGE_DIR, PRISMA_BIN } from "./db-package";
import { assertIntegrationDatabaseName, databaseNameOf } from "./database-name";
import { childProcessEnv } from "./env";

const execFileAsync = promisify(execFile);

const quoteIdentifier = (name: string): string => `"${name.replaceAll('"', '""')}"`;

/** Runs one statement on the admin connection (`TEST_DATABASE_URL`) and disconnects. */
async function onServer(serverUrl: string, sql: string): Promise<void> {
  const admin = createPrismaClient({ databaseUrl: serverUrl, log: ["error"] });
  try {
    await admin.$executeRawUnsafe(sql);
  } finally {
    await admin.$disconnect();
  }
}

/** `CREATE DATABASE` for a harness-generated name (see `assertIntegrationDatabaseName`). */
export async function createDatabase(serverUrl: string, databaseUrl: string): Promise<void> {
  const name = assertIntegrationDatabaseName(databaseNameOf(databaseUrl));
  await onServer(serverUrl, `CREATE DATABASE ${quoteIdentifier(name)}`);
}

/**
 * Drops a harness-generated database, closing any connection a crashed test left open.
 * Refuses any name the harness did not generate, so it can never drop a real database.
 */
export async function dropDatabase(serverUrl: string, databaseUrl: string): Promise<void> {
  const name = assertIntegrationDatabaseName(databaseNameOf(databaseUrl));
  await onServer(serverUrl, `DROP DATABASE IF EXISTS ${quoteIdentifier(name)} WITH (FORCE)`);
}

/**
 * Applies the versioned migrations of `@repo/db` with `prisma migrate deploy`, the same
 * command the production `migrate` image runs. Fails with the CLI output on error.
 */
export async function applyMigrations(databaseUrl: string): Promise<void> {
  try {
    await execFileAsync(PRISMA_BIN, ["migrate", "deploy"], {
      cwd: DB_PACKAGE_DIR,
      env: childProcessEnv({ DATABASE_URL: databaseUrl }),
      timeout: 120_000,
    });
  } catch (error) {
    const output = (error as { stdout?: string; stderr?: string } | null) ?? {};
    throw new Error(
      `prisma migrate deploy failed:\n${output.stdout ?? ""}${output.stderr ?? ""}`.trim(),
      { cause: error },
    );
  }
}
