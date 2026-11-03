/**
 * `pnpm db:seed` — creates the first administrator from SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD.
 *
 * Idempotent: an existing user is only promoted to `admin` (its password is never changed).
 * The account is created through Better Auth so the password hash and credential account match
 * what sign-in expects.
 */
import { createAuth } from "@repo/auth";
import { createPrismaClient, type PrismaClient } from "@repo/db";
import { createLogger } from "@repo/observability";
import { createEnv, emailSchema, nameSchema, passwordSchema, ROLES } from "@repo/shared";
import type { z } from "zod";

import { serverEnvSchema } from "../env.schema";

const seedEnvSchema = serverEnvSchema
  .pick({
    NODE_ENV: true,
    DATABASE_URL: true,
    BETTER_AUTH_SECRET: true,
    BETTER_AUTH_URL: true,
    TRUSTED_ORIGINS: true,
  })
  .extend({
    SEED_ADMIN_EMAIL: emailSchema,
    SEED_ADMIN_PASSWORD: passwordSchema,
    SEED_ADMIN_NAME: nameSchema.default("Administrador"),
  });

type SeedEnv = z.output<typeof seedEnvSchema>;

const logger = createLogger({ service: "server-seed" });

const ensureAdmin = async (db: PrismaClient, env: SeedEnv): Promise<void> => {
  const email = env.SEED_ADMIN_EMAIL;
  const existing = await db.user.findUnique({ where: { email }, select: { id: true, role: true } });

  if (existing === null) {
    const auth = createAuth({
      db,
      secret: env.BETTER_AUTH_SECRET,
      baseURL: env.BETTER_AUTH_URL,
      trustedOrigins: env.TRUSTED_ORIGINS,
      isProduction: env.NODE_ENV === "production",
      logger,
    });
    await auth.api.signUpEmail({
      body: { email, password: env.SEED_ADMIN_PASSWORD, name: env.SEED_ADMIN_NAME },
    });
    logger.info({ email }, "Admin user created");
  } else if (existing.role === ROLES.admin) {
    logger.info({ email }, "Admin user already exists; nothing to do");
    return;
  }

  await db.user.update({ where: { email }, data: { role: ROLES.admin, emailVerified: true } });
  logger.info({ email }, "Admin role granted");
};

const main = async (): Promise<void> => {
  const env = createEnv(seedEnvSchema, process.env);
  const db = createPrismaClient({ databaseUrl: env.DATABASE_URL, logger });
  try {
    await ensureAdmin(db, env);
  } finally {
    await db.$disconnect();
  }
};

main().catch((error: unknown) => {
  logger.fatal({ err: error }, "Seed failed");
  process.exitCode = 1;
});
