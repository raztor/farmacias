/**
 * `pnpm db:seed` — loads the synthetic data of a demo environment (RNF-06). Idempotent: it can be
 * re-run safely. One exported function per concern, run in order by `main`:
 * - `seedAccounts` (`./seed-accounts`): preregistered accounts (residents, operator, admin).
 * - `seedDemoCatalog` (`./seed-catalog`): ≥ 200 synthetic products with their stock.
 * - `seedDemoOrders` (`./seed-demo-orders`): a few orders in several statuses, created through
 *   the real ordering services (events, stock movements and audit stay consistent).
 *
 * Add further steps (catalog, inventory, orders…) as their own `seed-<concern>.ts` module and
 * call them from `runSeed` after the accounts.
 */
import { createAuth } from "@repo/auth";
import { createPrismaClient, type PrismaClient } from "@repo/db";
import { createLogger } from "@repo/observability";
import { createEnv } from "@repo/shared";
import type { z } from "zod";

import { serverEnvSchema } from "../env.schema";
import {
  createAccountStore,
  seedAccounts,
  seedAccountsEnvShape,
  toSeedPasswords,
} from "./seed-accounts";
import { seedDemoCatalog } from "./seed-catalog";
import {
  createDemoOrderServices,
  createDemoOrderStore,
  demoActorsFrom,
  seedDemoOrders,
} from "./seed-demo-orders";

const seedEnvSchema = serverEnvSchema
  .pick({
    NODE_ENV: true,
    DATABASE_URL: true,
    BETTER_AUTH_SECRET: true,
    BETTER_AUTH_URL: true,
    TRUSTED_ORIGINS: true,
  })
  .extend(seedAccountsEnvShape);

type SeedEnv = z.output<typeof seedEnvSchema>;

const logger = createLogger({ service: "server-seed" });

const runSeed = async (db: PrismaClient, env: SeedEnv): Promise<void> => {
  const auth = createAuth({
    db,
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    trustedOrigins: env.TRUSTED_ORIGINS,
    isProduction: env.NODE_ENV === "production",
    logger,
  });
  const accounts = await seedAccounts({
    store: createAccountStore({ db, auth }),
    passwords: toSeedPasswords(env),
    logger,
  });
  await seedDemoCatalog(db, logger);
  await seedDemoOrders({
    ...demoActorsFrom(accounts),
    store: createDemoOrderStore(db),
    services: createDemoOrderServices(db, logger),
    logger,
  });
};

const main = async (): Promise<void> => {
  const env = createEnv(seedEnvSchema, process.env);
  const db = createPrismaClient({ databaseUrl: env.DATABASE_URL, logger });
  try {
    await runSeed(db, env);
    logger.info("Seed completed");
  } finally {
    await db.$disconnect();
  }
};

main().catch((error: unknown) => {
  logger.fatal({ err: error }, "Seed failed");
  process.exitCode = 1;
});
