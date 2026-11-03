import "dotenv/config";

import { defineConfig } from "prisma/config";

/**
 * Prisma CLI configuration.
 *
 * `DATABASE_URL` is read lazily: `prisma generate` and `prisma validate` work without it
 * (CI typecheck has no database), while migrate/studio commands fail fast when it is missing.
 */
const databaseUrl = process.env.DATABASE_URL;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  ...(databaseUrl ? { datasource: { url: databaseUrl } } : {}),
});
