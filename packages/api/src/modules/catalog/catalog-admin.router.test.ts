import type { PrismaClient } from "@repo/db";
import type { Role } from "@repo/shared";
import { describe, expect, it, vi } from "vitest";

import { createCaller } from "../../root";
import { createTestDeps, createTestSession } from "../../testing/fakes";
import { createTRPCContext } from "../../trpc";

const FIELDS = {
  sku: "car-ten50-b1",
  commercialName: "Tensivar",
  activeIngredient: "Losartán potásico",
  presentation: "Comprimidos 50 mg x 30",
  category: "cardiovascular",
  priceClp: 6990,
  active: true,
} as const;

const dbRow = {
  id: "prod-1",
  ...FIELDS,
  sku: "CAR-TEN50-B1",
  updatedAt: new Date("2026-11-01T12:00:00.000Z"),
  inventory: { onHand: 0, lowStockThreshold: 5 },
};

type FakeDb = Record<string, unknown>;

/** Real context over a fake Prisma client; anonymous unless a role is given. */
const callerAs = async (role: Role | null, db: FakeDb = {}) =>
  createCaller(
    await createTRPCContext({
      deps: {
        ...createTestDeps({ session: role ? createTestSession({ id: "user-1", role }) : null }),
        db: db as unknown as PrismaClient,
      },
      headers: new Headers(),
      requestId: "test-request",
    }),
  );

type Caller = Awaited<ReturnType<typeof callerAs>>;

const ADMIN_CALLS: readonly [string, (caller: Caller) => Promise<unknown>][] = [
  ["adminList", (caller) => caller.catalog.adminList({})],
  ["adminById", (caller) => caller.catalog.adminById({ id: "prod-1" })],
  ["create", (caller) => caller.catalog.create(FIELDS)],
  [
    "update",
    (caller) => caller.catalog.update({ id: "prod-1", expectedUpdatedAt: new Date(), ...FIELDS }),
  ],
];

describe("catalog admin procedures: access (HU-11 #2, D-28, D-31)", () => {
  it.each(ADMIN_CALLS)("catalog.%s without a session → UNAUTHORIZED", async (_name, call) => {
    await expect(call(await callerAs(null))).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it.each(ADMIN_CALLS)("catalog.%s as operator → FORBIDDEN", async (_name, call) => {
    await expect(call(await callerAs("operator"))).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it.each(ADMIN_CALLS)("catalog.%s as resident → FORBIDDEN", async (_name, call) => {
    await expect(call(await callerAs("resident"))).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("catalog admin procedures as admin", () => {
  it("lists products including inactive ones (adminList)", async () => {
    const findMany = vi.fn(() => Promise.resolve([dbRow, { ...dbRow, id: "p2", active: false }]));
    const caller = await callerAs("admin", { product: { findMany } });

    const result = await caller.catalog.adminList({ q: "tensivar" });

    expect(result.items.map((item) => [item.id, item.active, item.onHand])).toEqual([
      ["prod-1", true, 0],
      ["p2", false, 0],
    ]);
    expect(result.nextCursor).toBeNull();
  });

  it("creates the product and its audit row in one transaction (create)", async () => {
    const create = vi.fn((_args: { data: Record<string, unknown> }) => Promise.resolve(dbRow));
    const createMany = vi.fn(() => Promise.resolve({ count: 1 }));
    const tx = { product: { create }, auditLog: { createMany } };
    const $transaction = vi.fn((run: (client: typeof tx) => Promise<unknown>) => run(tx));
    const caller = await callerAs("admin", { $transaction });

    const created = await caller.catalog.create(FIELDS);

    expect(created).toMatchObject({ id: "prod-1", sku: "CAR-TEN50-B1", onHand: 0 });
    expect($transaction).toHaveBeenCalledOnce();
    expect(create.mock.calls[0]?.[0].data).toMatchObject({
      sku: "CAR-TEN50-B1",
      inventory: { create: { onHand: 0, lowStockThreshold: 5 } },
    });
    expect(createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ action: "product.create", actorId: "user-1" })],
    });
  });

  it("maps a missing product to NOT_FOUND (adminById)", async () => {
    const caller = await callerAs("admin", {
      product: { findUnique: vi.fn(() => Promise.resolve(null)) },
    });

    await expect(caller.catalog.adminById({ id: "ghost" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("rejects an invalid product with BAD_REQUEST before touching the database", async () => {
    const $transaction = vi.fn();
    const caller = await callerAs("admin", { $transaction });

    await expect(caller.catalog.create({ ...FIELDS, priceClp: 0 })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    await expect(
      caller.catalog.update({
        id: "prod-1",
        expectedUpdatedAt: new Date(),
        ...FIELDS,
        category: "cosmeticos" as "otros",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect($transaction).not.toHaveBeenCalled();
  });
});
