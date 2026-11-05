import type { PrismaClient } from "@repo/db";
import { noopLogger, type Role } from "@repo/shared";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import {
  SEED_ACCOUNTS,
  createAccountStore,
  seedAccounts,
  seedAccountsEnvShape,
  toSeedPasswords,
  type AccountStore,
  type SeedAccount,
} from "./seed-accounts";

const PASSWORDS = {
  resident: "Vecino-Demo-2026",
  operator: "Operador-Demo-2026",
  admin: "Admin-Demo-2026",
} as const;

/** In-memory store keyed by email. */
const createMemoryStore = (initial: Record<string, { id: string; role: string | null }> = {}) => {
  const users = new Map(Object.entries(initial));
  const created: { email: string; role: Role; password: string }[] = [];
  const store: AccountStore = {
    findByEmail: (email) => Promise.resolve(users.get(email) ?? null),
    create: vi.fn((account: SeedAccount & { password: string }) => {
      const id = `id-${account.email}`;
      users.set(account.email, { id, role: account.role });
      created.push({ email: account.email, role: account.role, password: account.password });
      return Promise.resolve(id);
    }),
    setRole: vi.fn((userId: string, role: Role) => {
      for (const user of users.values()) if (user.id === userId) user.role = role;
      return Promise.resolve();
    }),
  };
  return { store, users, created };
};

describe("SEED_ACCOUNTS", () => {
  it("lists the synthetic accounts of the domain brief", () => {
    expect(SEED_ACCOUNTS.map(({ email, role }) => `${email}:${role}`)).toEqual([
      "residente1@demo.farmacia.cl:resident",
      "residente2@demo.farmacia.cl:resident",
      "residente3@demo.farmacia.cl:resident",
      "operador@demo.farmacia.cl:operator",
      "admin@demo.farmacia.cl:admin",
    ]);
  });
});

describe("seed env", () => {
  const schema = z.object(seedAccountsEnvShape);

  it("requires one password per role and maps them by role", () => {
    const env = schema.parse({
      SEED_RESIDENT_PASSWORD: PASSWORDS.resident,
      SEED_OPERATOR_PASSWORD: PASSWORDS.operator,
      SEED_ADMIN_PASSWORD: PASSWORDS.admin,
    });

    expect(toSeedPasswords(env)).toEqual(PASSWORDS);
  });

  it("enforces the password policy", () => {
    const result = schema.safeParse({
      SEED_RESIDENT_PASSWORD: "short",
      SEED_OPERATOR_PASSWORD: PASSWORDS.operator,
    });

    expect(result.error?.issues.map((issue) => issue.path.join("."))).toEqual([
      "SEED_RESIDENT_PASSWORD",
      "SEED_ADMIN_PASSWORD",
    ]);
  });
});

describe("seedAccounts", () => {
  it("creates every missing account with the password of its role", async () => {
    const { store, created } = createMemoryStore();

    const seeded = await seedAccounts({ store, passwords: PASSWORDS, logger: noopLogger });

    expect(seeded.every((account) => account.outcome === "created")).toBe(true);
    expect(created).toEqual(
      SEED_ACCOUNTS.map(({ email, role }) => ({ email, role, password: PASSWORDS[role] })),
    );
    expect(seeded.map((account) => account.id)).toEqual(
      SEED_ACCOUNTS.map(({ email }) => `id-${email}`),
    );
  });

  it("is idempotent: a second run changes nothing", async () => {
    const { store } = createMemoryStore();
    await seedAccounts({ store, passwords: PASSWORDS, logger: noopLogger });

    const second = await seedAccounts({ store, passwords: PASSWORDS, logger: noopLogger });

    expect(second.map((account) => account.outcome)).toEqual(Array(5).fill("unchanged"));
    expect(store.create).toHaveBeenCalledTimes(5);
    expect(store.setRole).not.toHaveBeenCalled();
  });

  it("restores a drifted role without touching the password", async () => {
    const { store, users } = createMemoryStore({
      "operador@demo.farmacia.cl": { id: "op-1", role: "resident" },
    });

    const seeded = await seedAccounts({ store, passwords: PASSWORDS, logger: noopLogger });

    expect(seeded.find((account) => account.id === "op-1")?.outcome).toBe("role-updated");
    expect(store.setRole).toHaveBeenCalledExactlyOnceWith("op-1", "operator");
    expect(users.get("operador@demo.farmacia.cl")?.role).toBe("operator");
    expect(store.create).toHaveBeenCalledTimes(4);
  });
});

type StoreAuth = Parameters<typeof createAccountStore>[0]["auth"];

describe("createAccountStore", () => {
  it("creates accounts through Better Auth with a verified email and the given role", async () => {
    const createUser = vi.fn(() => Promise.resolve({ user: { id: "new-id" } }));
    const auth = { api: { createUser } } as unknown as StoreAuth;
    const store = createAccountStore({ db: {} as PrismaClient, auth });

    await expect(
      store.create({ email: "a@demo.farmacia.cl", name: "A", role: "operator", password: "x" }),
    ).resolves.toBe("new-id");
    expect(createUser).toHaveBeenCalledWith({
      body: {
        email: "a@demo.farmacia.cl",
        name: "A",
        password: "x",
        role: "operator",
        data: { emailVerified: true },
      },
    });
  });

  it("reads and updates roles with Prisma", async () => {
    const findUnique = vi.fn(() => Promise.resolve({ id: "u1", role: "resident" }));
    const update = vi.fn(() => Promise.resolve({}));
    const db = { user: { findUnique, update } } as unknown as PrismaClient;
    const store = createAccountStore({ db, auth: { api: {} } as unknown as StoreAuth });

    await expect(store.findByEmail("a@demo.farmacia.cl")).resolves.toEqual({
      id: "u1",
      role: "resident",
    });
    await store.setRole("u1", "admin");

    expect(findUnique).toHaveBeenCalledWith({
      where: { email: "a@demo.farmacia.cl" },
      select: { id: true, role: true },
    });
    expect(update).toHaveBeenCalledWith({ where: { id: "u1" }, data: { role: "admin" } });
  });
});
