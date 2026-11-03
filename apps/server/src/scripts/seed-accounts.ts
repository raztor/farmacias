import type { Auth } from "@repo/auth";
import type { PrismaClient } from "@repo/db";
import { passwordSchema, ROLES, type AppLogger, type Role } from "@repo/shared";
import type { z } from "zod";

/**
 * Synthetic preregistered accounts (RNF-06, D-07). Public sign-up is disabled, so these are the
 * only accounts of a fresh environment. Emails use the reserved demo domain; passwords come from
 * the environment (`SEED_*_PASSWORD`, synthetic dev values in `.env.example`).
 */
export const SEED_ACCOUNTS = [
  { email: "residente1@demo.farmacia.cl", name: "Residente Demo Uno", role: ROLES.resident },
  { email: "residente2@demo.farmacia.cl", name: "Residente Demo Dos", role: ROLES.resident },
  { email: "residente3@demo.farmacia.cl", name: "Residente Demo Tres", role: ROLES.resident },
  { email: "operador@demo.farmacia.cl", name: "Operador Demo", role: ROLES.operator },
  { email: "admin@demo.farmacia.cl", name: "Administrador Demo", role: ROLES.admin },
] as const satisfies readonly SeedAccount[];

export type SeedAccount = { email: string; name: string; role: Role };

/** Environment variables read by {@link seedAccounts} (one password per role). */
export const seedAccountsEnvShape = {
  SEED_RESIDENT_PASSWORD: passwordSchema,
  SEED_OPERATOR_PASSWORD: passwordSchema,
  SEED_ADMIN_PASSWORD: passwordSchema,
};

export type SeedAccountsEnv = z.output<z.ZodObject<typeof seedAccountsEnvShape>>;

export type SeedPasswords = Readonly<Record<Role, string>>;

export const toSeedPasswords = (env: SeedAccountsEnv): SeedPasswords => ({
  resident: env.SEED_RESIDENT_PASSWORD,
  operator: env.SEED_OPERATOR_PASSWORD,
  admin: env.SEED_ADMIN_PASSWORD,
});

/** Persistence used by the seed (Better Auth for credentials, Prisma for role fixes). */
export type AccountStore = {
  findByEmail: (email: string) => Promise<{ id: string; role: string | null } | null>;
  /** Creates the user and its credential account; returns the new user id. */
  create: (account: SeedAccount & { password: string }) => Promise<string>;
  setRole: (userId: string, role: Role) => Promise<void>;
};

export type SeededAccount = {
  id: string;
  email: string;
  role: Role;
  outcome: "created" | "role-updated" | "unchanged";
};

export type SeedAccountsOptions = {
  store: AccountStore;
  passwords: SeedPasswords;
  logger: AppLogger;
  accounts?: readonly SeedAccount[];
};

const ensureAccount = async (
  store: AccountStore,
  account: SeedAccount,
  password: string,
): Promise<SeededAccount> => {
  const existing = await store.findByEmail(account.email);
  const base = { email: account.email, role: account.role };
  if (existing === null) {
    return { ...base, id: await store.create({ ...account, password }), outcome: "created" };
  }
  // Exact match: a role list such as "resident,admin" is normalized to the seeded role too.
  if (existing.role === account.role) return { ...base, id: existing.id, outcome: "unchanged" };
  await store.setRole(existing.id, account.role);
  return { ...base, id: existing.id, outcome: "role-updated" };
};

/**
 * Idempotently ensures every synthetic account exists with its role. Existing passwords are
 * never changed (re-running the seed is safe); a drifted role is restored.
 * Returns the accounts with their ids so later seed steps (orders…) can reference them.
 */
export const seedAccounts = async ({
  store,
  passwords,
  logger,
  accounts = SEED_ACCOUNTS,
}: SeedAccountsOptions): Promise<SeededAccount[]> => {
  const seeded: SeededAccount[] = [];
  for (const account of accounts) {
    const result = await ensureAccount(store, account, passwords[account.role]);
    logger.info(
      { email: result.email, role: result.role, outcome: result.outcome },
      "Seed account ensured",
    );
    seeded.push(result);
  }
  return seeded;
};

/** {@link AccountStore} backed by Better Auth (`createUser` hashes the password) and Prisma. */
export const createAccountStore = ({
  db,
  auth,
}: {
  db: PrismaClient;
  auth: Pick<Auth, "api">;
}): AccountStore => ({
  findByEmail: (email) =>
    db.user.findUnique({ where: { email }, select: { id: true, role: true } }),
  create: async ({ email, name, password, role }) => {
    // Server-side call without a session: allowed by the admin plugin for trusted code only.
    const { user } = await auth.api.createUser({
      body: { email, name, password, role, data: { emailVerified: true } },
    });
    return user.id;
  },
  setRole: async (userId, role) => {
    await db.user.update({ where: { id: userId }, data: { role } });
  },
});
