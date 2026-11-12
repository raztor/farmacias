import { beforeEach, describe, expect, it } from "vitest";

import { InMemoryOrdering } from "../../testing/in-memory-ordering";
import { createOrdersService, type OrdersService } from "./orders.service";

const RESIDENT = "resident-1";

let mem: InMemoryOrdering;
let service: OrdersService;

/** A paid previous order: 2 × Losartán and 3 × Melatonina, at old prices. */
const seedPreviousOrder = (status: "payment_validated" | "draft" = "payment_validated") => {
  mem.addOrder({ id: "previous", residentId: RESIDENT, status, fulfillment: "pickup" });
  mem.addLine({ orderId: "previous", productId: "p-losartan", quantity: 2, unitPriceClp: 1000 });
  mem.addLine({ orderId: "previous", productId: "p-melatonina", quantity: 3, unitPriceClp: 1000 });
};

const drafts = () => mem.state.orders.filter((order) => order.status === "draft");

beforeEach(() => {
  mem = new InMemoryOrdering();
  mem.addProduct({ id: "p-losartan", commercialName: "Losartán 50 mg", priceClp: 2490, onHand: 5 });
  mem.addProduct({ id: "p-melatonina", commercialName: "Melatonina 3 mg", priceClp: 3990 });
  service = createOrdersService({ repo: mem.ordersRepository() });
});

describe("orders service — repeat (HU-14, D-30)", () => {
  it("creates the draft with every product at the current catalog price", async () => {
    seedPreviousOrder();

    const result = await service.repeat({ residentId: RESIDENT, orderId: "previous" });

    expect(result.changes).toEqual([]);
    expect(result.draft).toMatchObject({
      status: "draft",
      itemCount: 5,
      totalClp: 2 * 2490 + 3 * 3990,
      lines: [
        { productId: "p-losartan", quantity: 2, unitPriceClp: 2490, lineTotalClp: 4980 },
        { productId: "p-melatonina", quantity: 3, unitPriceClp: 3990, lineTotalClp: 11_970 },
      ],
    });
    expect(drafts()).toHaveLength(1);
    expect(mem.state.events).toEqual([{ orderId: result.draft?.id, from: null, to: "draft" }]);
    expect(mem.product("p-losartan").onHand).toBe(5); // drafts reserve nothing (D-08)
  });

  it("sums into the existing draft, keeping its other lines and bumping the version", async () => {
    seedPreviousOrder();
    mem.addProduct({ id: "p-other", priceClp: 500 });
    await service.addItem({ residentId: RESIDENT, productId: "p-other", quantity: 1 });
    const before = await service.addItem({
      residentId: RESIDENT,
      productId: "p-losartan",
      quantity: 2,
    });

    const result = await service.repeat({ residentId: RESIDENT, orderId: "previous" });

    expect(result.draft?.id).toBe(before.id);
    expect(result.draft?.version).toBe(before.version + 1);
    expect(result.draft?.lines.map((line) => [line.productId, line.quantity])).toEqual([
      ["p-other", 1],
      ["p-losartan", 4],
      ["p-melatonina", 3],
    ]);
    expect(result.draft?.totalClp).toBe(500 + 4 * 2490 + 3 * 3990);
    expect(drafts()).toHaveLength(1);
  });

  it("reports reduced, unavailable and inactive products and adds the rest", async () => {
    seedPreviousOrder();
    mem.addLine({ orderId: "previous", productId: "p-ibuprofeno", quantity: 1, unitPriceClp: 900 });
    mem.addProduct({ id: "p-ibuprofeno", commercialName: "Ibuprofeno 400 mg", onHand: 0 });
    mem.product("p-melatonina").active = false;
    mem.product("p-losartan").onHand = 1;

    const result = await service.repeat({ residentId: RESIDENT, orderId: "previous" });

    expect(result.changes).toEqual([
      {
        productId: "p-losartan",
        commercialName: "Losartán 50 mg",
        presentation: "Comprimidos x 30",
        requested: 2,
        added: 1,
        reason: "reduced",
        lineCapReached: false,
      },
      {
        productId: "p-melatonina",
        commercialName: "Melatonina 3 mg",
        presentation: "Comprimidos x 30",
        requested: 3,
        added: 0,
        reason: "inactive",
        lineCapReached: false,
      },
      {
        productId: "p-ibuprofeno",
        commercialName: "Ibuprofeno 400 mg",
        presentation: "Comprimidos x 30",
        requested: 1,
        added: 0,
        reason: "unavailable",
        lineCapReached: false,
      },
    ]);
    expect(result.draft?.lines.map((line) => [line.productId, line.quantity])).toEqual([
      ["p-losartan", 1],
    ]);
  });

  it("creates no draft when nothing can be added", async () => {
    seedPreviousOrder();
    mem.product("p-losartan").onHand = 0;
    mem.product("p-melatonina").active = false;

    const result = await service.repeat({ residentId: RESIDENT, orderId: "previous" });

    expect(result.draft).toBeNull();
    expect(result.changes.map((change) => change.reason)).toEqual(["unavailable", "inactive"]);
    expect(drafts()).toHaveLength(0);
  });

  it("returns the unchanged draft when nothing can be added to it", async () => {
    seedPreviousOrder();
    await service.addItem({ residentId: RESIDENT, productId: "p-losartan", quantity: 5 });
    mem.product("p-melatonina").onHand = 0;
    const before = structuredClone(mem.state);

    const result = await service.repeat({ residentId: RESIDENT, orderId: "previous" });

    expect(result.draft?.lines).toMatchObject([{ productId: "p-losartan", quantity: 5 }]);
    expect(result.changes).toMatchObject([
      { productId: "p-losartan", requested: 2, added: 0, reason: "reduced" },
      { productId: "p-melatonina", requested: 3, added: 0, reason: "unavailable" },
    ]);
    expect(mem.state).toEqual(before);
  });

  it("answers NOT_FOUND for another resident's order or a missing one (D-10)", async () => {
    seedPreviousOrder();

    await expect(
      service.repeat({ residentId: "resident-2", orderId: "previous" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND", message: "No encontramos ese pedido." });
    await expect(
      service.repeat({ residentId: RESIDENT, orderId: "missing" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(drafts()).toHaveLength(0);
  });

  it("rejects repeating the draft itself with CONFLICT", async () => {
    seedPreviousOrder("draft");

    await expect(
      service.repeat({ residentId: RESIDENT, orderId: "previous" }),
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message: "Este pedido es tu carrito actual: revísalo en «Mi pedido».",
      details: { reason: "ORDER_NOT_REPEATABLE" },
    });
  });
});
