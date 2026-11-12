import { beforeEach, describe, expect, it } from "vitest";

import { createRecordingLogger } from "../../testing/fakes";
import { InMemoryOrdering } from "../../testing/in-memory-ordering";
import type {
  InventoryAdminRunner,
  InventoryReader,
  InventoryRecord,
} from "./inventory-admin.repository";
import {
  NEGATIVE_STOCK_MESSAGE,
  PRODUCT_NOT_FOUND_MESSAGE,
  createInventoryAdminService,
} from "./inventory-admin.service";

const OPERATOR = { actorId: "operator-1", actorRole: "operator" } as const;

let mem: InMemoryOrdering;
let thresholds: Map<string, number>;
let readerCalls: unknown[];

const recordOf = (id: string): InventoryRecord => {
  const product = mem.product(id);
  return {
    productId: id,
    sku: `SKU-${id}`,
    name: product.commercialName,
    presentation: product.presentation,
    active: product.active,
    onHand: product.onHand,
    lowStockThreshold: thresholds.get(id) ?? 5,
  };
};

const reader = (): InventoryReader => ({
  list: (query) => {
    readerCalls.push(query);
    return Promise.resolve(mem.state.products.map((product) => recordOf(product.id)));
  },
  findItem: (id) =>
    Promise.resolve(mem.state.products.some((p) => p.id === id) ? recordOf(id) : null),
  movements: (query) => {
    readerCalls.push(query);
    return Promise.resolve([]);
  },
  alerts: (take) => {
    readerCalls.push(take);
    const low = mem.state.products
      .map((product) => recordOf(product.id))
      .filter((record) => record.onHand <= record.lowStockThreshold);
    return Promise.resolve({ items: low, total: low.length });
  },
});

const runner = (): InventoryAdminRunner => ({
  transaction: (run) =>
    mem.inTransaction(() =>
      run({
        store: mem.inventoryStore(),
        audit: mem.auditWriter(),
        thresholds: {
          lockThreshold: (id) =>
            Promise.resolve(
              mem.state.products.some((p) => p.id === id)
                ? { onHand: mem.product(id).onHand, lowStockThreshold: thresholds.get(id) ?? 5 }
                : null,
            ),
          updateThreshold: (id, threshold) => {
            thresholds.set(id, threshold);
            return Promise.resolve();
          },
        },
      }),
    ),
});

const service = (logger = createRecordingLogger().logger) =>
  createInventoryAdminService({ reader: reader(), runner: runner(), logger });

beforeEach(() => {
  mem = new InMemoryOrdering();
  thresholds = new Map();
  readerCalls = [];
  mem.addProduct({ id: "p-a", onHand: 4 });
  mem.addProduct({ id: "p-b", onHand: 0 });
  mem.addProduct({ id: "p-c", onHand: 20 });
});

/** INV-U04..U06 (docs/specs/inventory.md): receipts and adjustments (HU-10, D-25). */
describe("inventory.adjust", () => {
  it("adds a receipt with its movement and stock.receipt audit row (HU-10 #1)", async () => {
    const { logger, entries } = createRecordingLogger();
    const result = await service(logger).adjust(OPERATOR, {
      productId: "p-a",
      kind: "receipt",
      delta: 6,
      reason: "Recepción proveedor",
    });

    expect(result).toMatchObject({ kind: "receipt", delta: 6, quantityBefore: 4 });
    expect(result.quantityAfter).toBe(10);
    expect(result.item).toMatchObject({ productId: "p-a", onHand: 10, level: "available" });
    expect(mem.state.locks).toEqual([["p-a"]]);
    expect(mem.state.movements).toEqual([
      {
        productId: "p-a",
        delta: 6,
        reason: "receipt",
        orderId: null,
        paymentId: null,
        actorId: "operator-1",
        quantityBefore: 4,
        quantityAfter: 10,
        note: "Recepción proveedor",
      },
    ]);
    expect(mem.state.audit).toEqual([
      {
        actorId: "operator-1",
        actorRole: "operator",
        action: "stock.receipt",
        entityType: "product",
        entityId: "p-a",
        before: { onHand: 4 },
        after: { onHand: 10 },
      },
    ]);
    expect(entries.some((entry) => entry.msg === "Stock adjusted")).toBe(true);
  });

  it("applies a negative adjustment down to exactly zero", async () => {
    const result = await service().adjust(OPERATOR, {
      productId: "p-a",
      kind: "adjustment",
      delta: -4,
      reason: "Merma por vencimiento",
    });
    expect(result.item).toMatchObject({ onHand: 0, level: "out" });
    expect(mem.state.audit[0]).toMatchObject({
      action: "stock.adjustment",
      before: { onHand: 4 },
      after: { onHand: 0 },
    });
    expect(mem.state.movements[0]).toMatchObject({ reason: "adjustment", delta: -4 });
  });

  it("rejects an adjustment that would leave negative stock and changes nothing (HU-10 #2)", async () => {
    await expect(
      service().adjust(OPERATOR, {
        productId: "p-a",
        kind: "adjustment",
        delta: -5,
        reason: "Conteo físico",
      }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: NEGATIVE_STOCK_MESSAGE,
      details: { reason: "NEGATIVE_STOCK", onHand: 4 },
    });
    expect(mem.product("p-a").onHand).toBe(4);
    expect(mem.state.movements).toEqual([]);
    expect(mem.state.audit).toEqual([]);
  });

  it("rolls back when the conditional decrement finds no row under the lock", async () => {
    const failing: InventoryAdminRunner = {
      transaction: (run) =>
        mem.inTransaction(() =>
          run({
            store: { ...mem.inventoryStore(), decrement: () => Promise.resolve(null) },
            audit: mem.auditWriter(),
            thresholds: {
              lockThreshold: () => Promise.resolve(null),
              updateThreshold: () => Promise.resolve(),
            },
          }),
        ),
    };
    const broken = createInventoryAdminService({ reader: reader(), runner: failing });
    await expect(
      broken.adjust(OPERATOR, {
        productId: "p-c",
        kind: "adjustment",
        delta: -1,
        reason: "Conteo",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mem.state.audit).toEqual([]);
  });

  it("answers NOT_FOUND for a product without inventory", async () => {
    await expect(
      service().adjust(OPERATOR, {
        productId: "p-x",
        kind: "receipt",
        delta: 1,
        reason: "Recepción",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND", message: PRODUCT_NOT_FOUND_MESSAGE });
    expect(mem.state.movements).toEqual([]);
  });
});

/** INV-U07, INV-U08: thresholds and alerts (HU-12, D-26, D-27). */
describe("inventory thresholds and alerts", () => {
  it("changes the threshold with an inventory.threshold_change audit row", async () => {
    const item = await service().setThreshold(OPERATOR, { productId: "p-c", threshold: 25 });
    expect(item).toMatchObject({ lowStockThreshold: 25, level: "low" });
    expect(mem.state.audit).toEqual([
      {
        actorId: "operator-1",
        actorRole: "operator",
        action: "inventory.threshold_change",
        entityType: "product",
        entityId: "p-c",
        before: { lowStockThreshold: 5 },
        after: { lowStockThreshold: 25 },
      },
    ]);
  });

  it("writes nothing when the threshold does not change", async () => {
    const item = await service().setThreshold(OPERATOR, { productId: "p-c", threshold: 5 });
    expect(item.lowStockThreshold).toBe(5);
    expect(mem.state.audit).toEqual([]);
  });

  it("answers NOT_FOUND for an unknown product", async () => {
    await expect(
      service().setThreshold(OPERATOR, { productId: "p-x", threshold: 3 }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(service().product("p-x")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("lists alerts with their level and the exact total", async () => {
    const result = await service().alerts();
    expect(readerCalls).toEqual([200]);
    expect(result.total).toBe(2);
    expect(result.items.map((item) => [item.productId, item.level])).toEqual([
      ["p-a", "low"],
      ["p-b", "out"],
    ]);
  });
});

describe("inventory reads", () => {
  it("pages the list, normalizes the search and keeps the raw text for the SKU", async () => {
    const result = await service().list({ limit: 2, search: "Ácido 500", onlyLow: true });
    expect(readerCalls).toEqual([
      { take: 3, cursor: undefined, term: "acido 500", sku: "Ácido 500", onlyLow: true },
    ]);
    expect(result.items).toHaveLength(2);
    expect(result.nextCursor).toBe(JSON.stringify(["Producto p-b", "p-b"]));
    expect(result.items[1]).toMatchObject({ productId: "p-b", level: "out" });
  });

  it("lists without filters on the last page", async () => {
    const result = await service().list({ limit: 20 });
    expect(readerCalls).toEqual([
      { take: 21, cursor: undefined, term: undefined, sku: undefined, onlyLow: false },
    ]);
    expect(result.nextCursor).toBeNull();
  });

  it("asks the ledger for one extra row", async () => {
    await expect(service().movements({ productId: "p-a", limit: 10 })).resolves.toEqual({
      items: [],
      nextCursor: null,
    });
    expect(readerCalls).toEqual([{ productId: "p-a", take: 11, cursor: undefined }]);
  });
});
