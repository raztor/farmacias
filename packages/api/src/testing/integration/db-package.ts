import { readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

/**
 * Location of the `@repo/db` workspace, which owns the Prisma schema, the versioned migrations
 * and the Prisma CLI. The harness applies exactly those migrations (what production runs), so
 * the integration tests always exercise the real schema, CHECK constraints included.
 *
 * Resolved through Node's module resolution (`@repo/db` → `packages/db/src/index.ts`), not a
 * hard-coded relative path.
 */
const dbEntry = createRequire(import.meta.url).resolve("@repo/db");

export const DB_PACKAGE_DIR = dirname(dirname(dbEntry));

export const MIGRATIONS_DIR = join(DB_PACKAGE_DIR, "prisma", "migrations");

export const PRISMA_BIN = join(
  DB_PACKAGE_DIR,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "prisma.cmd" : "prisma",
);

/** Names of the versioned migrations (`<timestamp>_<name>` folders), in apply order. */
export function listMigrationNames(): string[] {
  return readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}
