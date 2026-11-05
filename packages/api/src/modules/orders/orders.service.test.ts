import { beforeEach, describe, expect, it } from "vitest";

import { InMemoryOrdering } from "../../testing/in-memory-ordering";
import { DRAFT_NOT_FOUND_MESSAGE } from "./orders.errors";
import { createOrdersService, type OrdersService } from "./orders.service";

const RESIDENT = "resident-1";

let mem: InMemoryOrdering;
let service: OrdersService;

beforeEach(() => {
  mem = new InMemoryOrdering();
  mem.addProduct({ id: "p-losartan", commercialName: "Losartán 50 mg", priceClp: 2490, onHand: 5 });
  mem.addProduct({ id: "p-melatonina", commercialName: "Melatonina 3 mg", priceClp: 3990 });
  service = createOrdersService({ repo: mem.ordersRepository() });
});

const draftOf = (residentId = RESIDENT) =>
  mem.state.orders.find((order) => order.residentId === residentId && order.status === "draft");

describe("orders service — draft (HU-03)", () => {
  it("adds an available product, creating the draft and updating the summary (criterion 1)", async () => {
    const draft = await service.addItem({
      residentId: RESIDENT,
      productId: "p-losartan",
      quantity: 2,
    });

    expect(draft).toMatchObject({
      status: "draft",
      itemCount: 2,
      totalClp: 4980,
      lines: [
        {
          productId: "p-losartan",
          commercialName: "Losartán 50 mg",
          quantity: 2,
          unitPriceClp: 2490,
          lineTotalClp: 4980,
          availableQty: 5,
        },
      ],
    });
    expect(mem.state.events).toEqual([{ orderId: draft.id, from: null, to: "draft" }]);
    expect(mem.product("p-losartan").onHand).toBe(5); // no reservation (D-02)
  });

  it("adds to the existing line and keeps one draft per resident", async () => {
    await service.addItem({ residentId: RESIDENT, productId: "p-losartan", quantity: 2 });
    await service.addItem({ residentId: RESIDENT, productId: "p-melatonina", quantity: 1 });
    const draft = await service.addItem({
      residentId: RESIDENT,
      productId: "p-losartan",
      quantity: 3,
    });

    expect(draft.lines.map((line) => [line.productId, line.quantity]).sort()).toEqual([
      ["p-losartan", 5],
      ["p-melatonina", 1],
    ]);
    expect(draft.totalClp).toBe(5 * 2490 + 3990);
    expect(draft.itemCount).toBe(6);
    expect(mem.state.orders.filter((order) => order.status === "draft")).toHaveLength(1);
  });

  it("rejects a quantity above availability, reporting the maximum allowed (criterion 2)", async () => {
    await service.addItem({ residentId: RESIDENT, productId: "p-losartan", quantity: 2 });
    const before = structuredClone(mem.state);

    await expect(
      service.addItem({ residentId: RESIDENT, productId: "p-losartan", quantity: 4 }),
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message: "Solo puedes agregar hasta 3 unidades de Losartán 50 mg.",
      details: { reason: "QUANTITY_EXCEEDS_AVAILABLE", productId: "p-losartan", maxAllowed: 3 },
    });
    expect(mem.state).toEqual(before);
  });

  it("does not leave an empty draft behind when the first addition is rejected", async () => {
    await expect(
      service.addItem({ residentId: RESIDENT, productId: "p-losartan", quantity: 6 }),
    ).rejects.toMatchObject({ details: { maxAllowed: 5 } });
    expect(draftOf()).toBeUndefined();
    expect(mem.state.events).toEqual([]);
  });

  it("caps a line at 99 units even with more stock", async () => {
    mem.addProduct({ id: "p-big", commercialName: "Paracetamol", onHand: 500 });
    await service.addItem({ residentId: RESIDENT, productId: "p-big", quantity: 90 });

    await expect(
      service.addItem({ residentId: RESIDENT, productId: "p-big", quantity: 10 }),
    ).rejects.toMatchObject({ details: { maxAllowed: 9 } });
  });

  it("says the 99-per-line cap, not the stock, is the limit when more units exist", async () => {
    mem.addProduct({ id: "p-big", commercialName: "Paracetamol", onHand: 150 });
    await service.addItem({ residentId: RESIDENT, productId: "p-big", quantity: 99 });

    await expect(
      service.addItem({ residentId: RESIDENT, productId: "p-big", quantity: 1 }),
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message: "Ya tienes en tu pedido 99 unidades de Paracetamol, el máximo por producto.",
      details: { reason: "QUANTITY_EXCEEDS_AVAILABLE", maxAllowed: 0 },
    });
  });

  it("explains when nothing more can be added", async () => {
    mem.addProduct({ id: "p-out", commercialName: "Celecoxib", onHand: 0 });
    await expect(
      service.addItem({ residentId: RESIDENT, productId: "p-out", quantity: 1 }),
    ).rejects.toMatchObject({
      message: "Celecoxib no tiene unidades disponibles por ahora.",
      details: { maxAllowed: 0 },
    });
    await service.addItem({ residentId: RESIDENT, productId: "p-losartan", quantity: 5 });
    await expect(
      service.addItem({ residentId: RESIDENT, productId: "p-losartan", quantity: 1 }),
    ).rejects.toMatchObject({
      message: "Ya tienes en tu pedido todas las unidades disponibles de Losartán 50 mg.",
    });
  });

  it.each([
    ["missing", "p-unknown"],
    ["inactive", "p-inactive"],
  ])("answers NOT_FOUND for a %s product", async (_case, productId) => {
    mem.addProduct({ id: "p-inactive", active: false });
    await expect(
      service.addItem({ residentId: RESIDENT, productId, quantity: 1 }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("sets a line quantity within availability", async () => {
    await service.addItem({ residentId: RESIDENT, productId: "p-losartan", quantity: 1 });
    const draft = await service.setQuantity({
      residentId: RESIDENT,
      productId: "p-losartan",
      quantity: 5,
    });
    expect(draft.lines[0]).toMatchObject({ quantity: 5, lineTotalClp: 5 * 2490 });

    await expect(
      service.setQuantity({ residentId: RESIDENT, productId: "p-losartan", quantity: 6 }),
    ).rejects.toMatchObject({ code: "CONFLICT", details: { maxAllowed: 5 } });
  });

  it("answers NOT_FOUND when setting or removing a line that is not in the draft", async () => {
    await expect(
      service.setQuantity({ residentId: RESIDENT, productId: "p-losartan", quantity: 1 }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await service.addItem({ residentId: RESIDENT, productId: "p-losartan", quantity: 1 });
    await expect(
      service.setQuantity({ residentId: RESIDENT, productId: "p-melatonina", quantity: 1 }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      service.removeItem({ residentId: RESIDENT, productId: "p-melatonina" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("removes a line and recomputes the total", async () => {
    await service.addItem({ residentId: RESIDENT, productId: "p-losartan", quantity: 2 });
    await service.addItem({ residentId: RESIDENT, productId: "p-melatonina", quantity: 1 });
    const draft = await service.removeItem({ residentId: RESIDENT, productId: "p-losartan" });
    expect(draft.lines.map((line) => line.productId)).toEqual(["p-melatonina"]);
    expect(draft.totalClp).toBe(3990);
  });

  it("returns null when the resident has no draft and only shows their own draft", async () => {
    await expect(service.draft(RESIDENT)).resolves.toBeNull();
    await service.addItem({ residentId: "resident-2", productId: "p-losartan", quantity: 1 });
    await expect(service.draft(RESIDENT)).resolves.toBeNull();
    await expect(service.draft("resident-2")).resolves.toMatchObject({ itemCount: 1 });
  });

  it("starts a new draft after the previous one was confirmed (only drafts are editable)", async () => {
    mem.addOrder({ id: "o-pending", residentId: RESIDENT, status: "pending_payment" });
    const draft = await service.addItem({
      residentId: RESIDENT,
      productId: "p-losartan",
      quantity: 1,
    });
    expect(draft.id).not.toBe("o-pending");
    expect(mem.linesOf("o-pending")).toEqual([]);
  });
});

describe("orders service — after confirming (R-ORD-15)", () => {
  beforeEach(() => {
    mem.addOrder({ id: "o-pending", residentId: RESIDENT, status: "pending_payment" });
    mem.addLine({ orderId: "o-pending", productId: "p-losartan", quantity: 2, unitPriceClp: 2490 });
  });

  it("a stale edit answers NOT_FOUND pointing to «Mis pedidos» and never touches the order", async () => {
    const noDraft = {
      code: "NOT_FOUND",
      message: DRAFT_NOT_FOUND_MESSAGE,
      details: { reason: "NO_DRAFT" },
    };

    await expect(
      service.setQuantity({ residentId: RESIDENT, productId: "p-losartan", quantity: 1 }),
    ).rejects.toMatchObject(noDraft);
    await expect(
      service.removeItem({ residentId: RESIDENT, productId: "p-losartan" }),
    ).rejects.toMatchObject(noDraft);
    await expect(
      service.setFulfillment({ residentId: RESIDENT, type: "pickup" }),
    ).rejects.toMatchObject(noDraft);
    expect(mem.linesOf("o-pending")).toEqual([
      expect.objectContaining({ productId: "p-losartan", quantity: 2 }),
    ]);
    expect(mem.statusOf("o-pending")).toBe("pending_payment");
  });
});

describe("orders service — fulfillment (HU-04)", () => {
  const delivery = {
    type: "delivery",
    sector: "Villa Sintética",
    addressReference: "Pasaje Ficticio 123",
    contactAlias: "Vecina Demo",
    instructions: null,
  } as const;

  it("stores pickup without any address (criterion 1)", async () => {
    await service.addItem({ residentId: RESIDENT, productId: "p-losartan", quantity: 1 });
    await service.setFulfillment({ residentId: RESIDENT, ...delivery });
    const draft = await service.setFulfillment({ residentId: RESIDENT, type: "pickup" });
    expect(draft).toMatchObject({ fulfillment: "pickup", delivery: null });
    expect(draftOf()?.delivery).toBeNull();
  });

  it("stores the synthetic delivery data", async () => {
    await service.addItem({ residentId: RESIDENT, productId: "p-losartan", quantity: 1 });
    const draft = await service.setFulfillment({ residentId: RESIDENT, ...delivery });
    expect(draft).toMatchObject({
      fulfillment: "delivery",
      delivery: { sector: "Villa Sintética", contactAlias: "Vecina Demo", instructions: null },
    });
  });

  it("answers NOT_FOUND without a draft", async () => {
    await expect(
      service.setFulfillment({ residentId: RESIDENT, type: "pickup" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
