import { describe, expect, it, vi } from "vitest";

import { createCaller } from "../../root";
import { createTestContext, createTestSession, type FakeDb } from "../../testing/fakes";

const resident = createTestSession({ id: "resident-1", role: "resident" });
const operator = createTestSession({ id: "operator-1", role: "operator" });
const admin = createTestSession({ id: "admin-1", role: "admin" });

const ADJUST = { productId: "p1", kind: "receipt", delta: 3, reason: "Recepción" } as const;

/** Every inventory procedure, called (lazily) through the real router and guards. */
const callAll = (caller: ReturnType<typeof createCaller>) => [
  () => caller.inventory.list({}),
  () => caller.inventory.product({ productId: "p1" }),
  () => caller.inventory.movements({ productId: "p1" }),
  () => caller.inventory.adjust(ADJUST),
  () => caller.inventory.alerts(),
  () => caller.inventory.setThreshold({ productId: "p1", threshold: 3 }),
];

const ROW = {
  productId: "p1",
  onHand: 2,
  lowStockThreshold: 5,
  product: { sku: "SKU-1", commercialName: "Paracetamol", presentation: "x 16", active: true },
};

/** INV-U09 (docs/specs/inventory.md): access control of the back-office stock (D-31). */
describe("inventory router", () => {
  it("rejects anonymous callers with UNAUTHORIZED on every procedure", async () => {
    const caller = createCaller(await createTestContext());
    for (const call of callAll(caller)) {
      await expect(call()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    }
  });

  it("rejects residents with FORBIDDEN on every procedure, before any database access", async () => {
    const findMany = vi.fn();
    const $transaction = vi.fn();
    const db = { inventoryItem: { findMany }, $transaction } as unknown as FakeDb;
    const caller = createCaller(await createTestContext({ session: resident, db }));

    for (const call of callAll(caller)) {
      await expect(call()).rejects.toMatchObject({
        code: "FORBIDDEN",
        message: "No tienes permisos para realizar esta acción.",
      });
    }
    expect(findMany).not.toHaveBeenCalled();
    expect($transaction).not.toHaveBeenCalled();
  });

  it.each([
    ["operator", operator],
    ["admin", admin],
  ])("lets %s list the stock with its level", async (_role, session) => {
    const findMany = vi.fn(() => Promise.resolve([ROW]));
    const db = {
      inventoryItem: { findMany, fields: { lowStockThreshold: "ref" } },
    } as unknown as FakeDb;
    const caller = createCaller(await createTestContext({ session, db }));

    await expect(caller.inventory.list({ onlyLow: true })).resolves.toEqual({
      items: [
        {
          productId: "p1",
          sku: "SKU-1",
          name: "Paracetamol",
          presentation: "x 16",
          active: true,
          onHand: 2,
          lowStockThreshold: 5,
          level: "low",
        },
      ],
      nextCursor: null,
    });
    const [args] = findMany.mock.calls[0] as unknown as [{ where: unknown }];
    expect(args.where).toEqual({ AND: [{}, { onHand: { lte: "ref" } }] });
  });

  it("rejects a receipt without reason before opening a transaction (HU-10 #2)", async () => {
    const $transaction = vi.fn();
    const caller = createCaller(
      await createTestContext({ session: operator, db: { $transaction } }),
    );
    const missingReason = caller.inventory.adjust({ ...ADJUST, reason: "  " });
    await expect(missingReason).rejects.toMatchObject({ code: "BAD_REQUEST" });
    // The HTTP error formatter sends this first zod message to the form.
    await expect(missingReason).rejects.toThrow("Indica el motivo (al menos 5 caracteres).");
    await expect(caller.inventory.adjust({ ...ADJUST, delta: -1 })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect($transaction).not.toHaveBeenCalled();
  });

  it("takes the actor from the session, never from the input", async () => {
    const createMany = vi.fn(() => Promise.resolve({ count: 1 }));
    const queryRaw = vi
      .fn()
      .mockResolvedValueOnce([{ productId: "p1", onHand: 2 }])
      .mockResolvedValueOnce([{ onHand: 5 }]);
    const tx = { $queryRaw: queryRaw, stockMovement: { createMany }, auditLog: { createMany } };
    const db = {
      $transaction: (run: (client: typeof tx) => Promise<unknown>) => run(tx),
      inventoryItem: { findUnique: vi.fn(() => Promise.resolve({ ...ROW, onHand: 5 })) },
    } as unknown as FakeDb;
    const caller = createCaller(await createTestContext({ session: admin, db }));

    await expect(caller.inventory.adjust(ADJUST)).resolves.toMatchObject({
      quantityBefore: 2,
      quantityAfter: 5,
      item: { onHand: 5 },
    });
    expect(createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          actorId: "admin-1",
          actorRole: "admin",
          action: "stock.receipt",
        }),
      ],
    });
  });

  it("validates the threshold range (HU-12, D-26)", async () => {
    const $transaction = vi.fn();
    const caller = createCaller(
      await createTestContext({ session: operator, db: { $transaction } }),
    );
    const outOfRange = caller.inventory.setThreshold({ productId: "p1", threshold: 1000 });
    await expect(outOfRange).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(outOfRange).rejects.toThrow("El umbral debe ser un número entero entre 0 y 999.");
    expect($transaction).not.toHaveBeenCalled();
  });
});
