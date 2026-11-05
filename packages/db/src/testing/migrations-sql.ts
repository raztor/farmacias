import { readdirSync, readFileSync } from "node:fs";

/**
 * Every SQL file of the versioned migrations, concatenated in apply order (test-only module).
 * Migration folders start with a timestamp, so sorting by name is the order Prisma applies them.
 */
export function readMigrationsSql(): string {
  const directory = new URL("../../prisma/migrations/", import.meta.url);
  return readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .map((name) => readFileSync(new URL(`${name}/migration.sql`, directory), "utf8"))
    .join("\n");
}
