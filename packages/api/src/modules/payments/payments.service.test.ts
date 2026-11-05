import { beforeEach, describe, expect, it, vi } from "vitest";

import { createInMemoryPaymentsRepository } from "../../testing/in-memory-payments";
import { InMemoryOrdering } from "../../testing/in-memory-ordering";
import type { PaymentGateway } from "./payment-gateway";
import { createPaymentsService, type PaymentsService } from "./payments.service";

const RESIDENT = "resident-1";
const KEY_1 = "11111111-1111-4111-8111-111111111111";
const KEY_2 = "22222222-2222-4222-8222-222222222222";

let mem: InMemoryOrdering;
let charge: ReturnType<typeof vi.fn<PaymentGateway["charge"]>>;
let service: PaymentsService;

beforeEach(() => {
  mem = new InMemoryOrdering();
  mem.addProduct({ id: "p-a", commercialName: "Losartán 50 mg", onHand: 5 });
  mem.addProduct({ id: "p-b", commercialName: "Melatonina 3 mg", onHand: 2 });
  mem.addOrder({
    id: "o1",
    residentId: RESIDENT,
    status: "pending_payment",
    fulfillment: "pickup",
    totalClp: 9000,
    version: 2,
  });
  mem.addLine({ orderId: "o1", productId: "p-b", quantity: 2, unitPriceClp: 2000 });
  mem.addLine({ orderId: "o1", productId: "p-a", quantity: 1, unitPriceClp: 5000 });
  charge = vi.fn<PaymentGateway["charge"]>(({ scenario }) =>
    Promise.resolve({
      outcome: scenario === "approve" ? "approved" : "rejected",
      reference: "SIM-FAKE",
    }),
  );
  service = createPaymentsService({
    repo: createInMemoryPaymentsRepository(mem),
    gateway: { charge },
  });
});

const pay = (overrides: Partial<Parameters<PaymentsService["pay"]>[0]> = {}) =>
  service.pay({
    residentId: RESIDENT,
    orderId: "o1",
    idempotencyKey: KEY_1,
    scenario: "approve",
    ...overrides,
  });

const stock = () => [mem.product("p-a").onHand, mem.product("p-b").onHand];

describe("payments service — approved (HU-05 #1, HU-06 #1)", () => {
  it("validates the order, discounts once and confirms", async () => {
    const result = await pay();

    expect(result).toMatchObject({
      outcome: "approved",
      reference: "SIM-FAKE",
      replayed: false,
      order: { id: "o1", status: "payment_validated", statusLabel: "Pago validado", version: 3 },
    });
    expect(result.message).toContain("Pago validado");
    expect(charge).toHaveBeenCalledWith({
      orderId: "o1",
      amountClp: 9000,
      idempotencyKey: KEY_1,
      scenario: "approve",
    });
    expect(stock()).toEqual([4, 0]);
    expect(mem.state.locks).toEqual([["p-a", "p-b"]]);
    expect(mem.state.payments).toEqual([
      expect.objectContaining({ orderId: "o1", status: "approved", amountClp: 9000 }),
    ]);
    expect(mem.state.events).toEqual([
      expect.objectContaining({
        from: "pending_payment",
        to: "payment_validated",
        actorRole: "system",
        actorId: null,
      }),
    ]);
    expect(mem.state.audit.map((entry) => entry.action).sort()).toEqual([
      "order.transition",
      "stock.sale",
      "stock.sale",
    ]);
  });

  it("accepts a new approved attempt after a rejection (R-PAY-08)", async () => {
    await pay({ scenario: "reject" });
    const result = await pay({ idempotencyKey: KEY_2 });
    expect(result.order.status).toBe("payment_validated");
    expect(stock()).toEqual([4, 0]);
  });
});

describe("payments service — rejected (HU-05 #2)", () => {
  it("informs the rejection and leaves the stock untouched", async () => {
    const result = await pay({ scenario: "reject" });

    expect(result).toMatchObject({ outcome: "rejected", order: { status: "payment_rejected" } });
    expect(result.message).toBe(
      "Tu pago simulado fue rechazado. Puedes intentarlo de nuevo o cancelar el pedido.",
    );
    expect(stock()).toEqual([5, 2]);
    expect(mem.state.movements).toEqual([]);
    expect(mem.state.locks).toEqual([]);
  });

  it("records a repeated rejection as payment_rejected → payment_rejected", async () => {
    await pay({ scenario: "reject" });
    await pay({ scenario: "reject", idempotencyKey: KEY_2 });
    expect(mem.state.events.map((event) => [event.from, event.to])).toEqual([
      ["pending_payment", "payment_rejected"],
      ["payment_rejected", "payment_rejected"],
    ]);
  });
});

describe("payments service — idempotency (HU-05 #3)", () => {
  it("returns the stored result for a repeated key without calling the gateway again", async () => {
    const first = await pay();
    const again = await pay();

    expect(again).toMatchObject({
      paymentId: first.paymentId,
      outcome: "approved",
      replayed: true,
    });
    expect(charge).toHaveBeenCalledTimes(1);
    expect(stock()).toEqual([4, 0]);
    expect(mem.state.payments).toHaveLength(1);
  });

  it("never discounts twice for an already paid order, even with a new key", async () => {
    const first = await pay();
    const again = await pay({ idempotencyKey: KEY_2 });

    expect(again).toMatchObject({ paymentId: first.paymentId, replayed: true });
    expect(charge).toHaveBeenCalledTimes(1);
    expect(stock()).toEqual([4, 0]);
  });

  it("replays a rejected attempt as rejected", async () => {
    await pay({ scenario: "reject" });
    await expect(pay({ scenario: "approve" })).resolves.toMatchObject({
      outcome: "rejected",
      replayed: true,
    });
  });

  it("tells a replayed rejection that the order was paid since (RNF-09)", async () => {
    await pay({ scenario: "reject" });
    await pay({ idempotencyKey: KEY_2 });

    const replay = await pay({ scenario: "reject" });

    expect(replay).toMatchObject({ outcome: "rejected", replayed: true });
    expect(replay.order.status).toBe("payment_validated");
    expect(replay.message).toBe(
      "Este intento de pago ya había sido rechazado. Tu pedido P-o1 ahora está en «Pago validado». " +
        "Revisa su estado en «Mis pedidos».",
    );
  });

  it("tells a replayed approval that the order was cancelled since (RNF-09)", async () => {
    await pay();
    mem.order("o1").status = "cancelled";

    const replay = await pay();

    expect(replay).toMatchObject({ outcome: "approved", replayed: true });
    expect(replay.message).not.toContain("pronto comenzará su preparación");
    expect(replay.message).toContain("ahora está en «Cancelado»");
  });

  it("refuses a key that belongs to another order's attempt", async () => {
    mem.addOrder({
      id: "o2",
      residentId: RESIDENT,
      status: "pending_payment",
      fulfillment: "pickup",
      totalClp: 1000,
    });
    await pay();
    await expect(pay({ orderId: "o2" })).rejects.toMatchObject({
      code: "CONFLICT",
      details: { reason: "IDEMPOTENCY_KEY_REUSED" },
    });
    expect(mem.statusOf("o2")).toBe("pending_payment");
  });
});

describe("payments service — stock conflict (HU-06 #2)", () => {
  it("keeps the order pending, discounts nothing and leaves evidence", async () => {
    mem.product("p-b").onHand = 1; // someone else took the last unit

    await expect(pay()).rejects.toMatchObject({
      code: "CONFLICT",
      message: expect.stringContaining("No hay stock suficiente de: Melatonina 3 mg") as unknown,
      details: {
        reason: "STOCK_CONFLICT",
        products: [
          { productId: "p-b", commercialName: "Melatonina 3 mg", requested: 2, available: 1 },
        ],
      },
    });
    expect(mem.statusOf("o1")).toBe("pending_payment");
    expect(stock()).toEqual([5, 1]);
    expect(mem.state.movements).toEqual([]);
    expect(mem.state.payments).toEqual([
      expect.objectContaining({ status: "stock_conflict", failureReason: "STOCK_CONFLICT" }),
    ]);
    expect(mem.state.audit).toEqual([
      expect.objectContaining({
        action: "payment.stock_conflict",
        entityType: "order",
        entityId: "o1",
        actorRole: "system",
      }),
    ]);
  });

  it("answers the same conflict for the same key, and a new key can succeed later", async () => {
    mem.product("p-b").onHand = 1;
    await expect(pay()).rejects.toMatchObject({ details: { reason: "STOCK_CONFLICT" } });
    await expect(pay()).rejects.toMatchObject({
      details: { reason: "STOCK_CONFLICT", products: [{ productId: "p-b" }] },
    });
    expect(charge).toHaveBeenCalledTimes(1);

    mem.product("p-b").onHand = 2;
    await expect(pay({ idempotencyKey: KEY_2 })).resolves.toMatchObject({ outcome: "approved" });
  });
});

describe("payments service — access and payable states (R-PAY-02)", () => {
  it("answers NOT_FOUND for another account's order or a missing one", async () => {
    await expect(pay({ residentId: "resident-2" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(pay({ orderId: "missing" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(charge).not.toHaveBeenCalled();
  });

  it.each(["draft", "cancelled"] as const)("refuses to pay a %s order", async (status) => {
    mem.order("o1").status = status;
    await expect(pay()).rejects.toMatchObject({
      code: "CONFLICT",
      details: { reason: "ORDER_NOT_PAYABLE", status },
    });
    expect(charge).not.toHaveBeenCalled();
  });

  it("refuses a paid order with no approved payment on record", async () => {
    mem.order("o1").status = "in_preparation";
    await expect(pay()).rejects.toMatchObject({ details: { reason: "ORDER_NOT_PAYABLE" } });
  });
});
