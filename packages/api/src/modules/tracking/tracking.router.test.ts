import { describe, expect, it, vi } from "vitest";

import { createCaller } from "../../root";
import { createTestContext, createTestSession } from "../../testing/fakes";

const resident = createTestSession({ id: "resident-1", role: "resident" });
const createdAt = new Date("2026-11-03T12:00:00.000Z");

const orderRow = {
  id: "o1",
  code: "P-000001",
  status: "payment_validated",
  fulfillment: "delivery",
  totalClp: 3980,
  createdAt,
  updatedAt: createdAt,
};

const detailRow = {
  ...orderRow,
  version: 2,
  deliverySector: "Villa Sintética",
  deliveryAddressReference: "Pasaje Ficticio 123",
  deliveryContactAlias: "Vecina Prueba",
  deliveryInstructions: null,
  lines: [
    {
      productId: "p1",
      quantity: 2,
      unitPriceClp: 1990,
      lineTotalClp: 3980,
      product: { commercialName: "Losartán 50 mg", presentation: "Comprimidos x 30" },
    },
  ],
  events: [
    { toStatus: "draft", actorRole: "resident", note: null, createdAt },
    { toStatus: "pending_payment", actorRole: "resident", note: null, createdAt },
    { toStatus: "payment_validated", actorRole: "system", note: null, createdAt },
  ],
};

describe("tracking procedures (orders.mine, orders.detail)", () => {
  it("rejects anonymous callers with UNAUTHORIZED", async () => {
    const caller = createCaller(await createTestContext());
    await expect(caller.orders.mine({})).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.orders.detail({ id: "o1" })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it.each(["operator", "admin"] as const)("rejects %s sessions with FORBIDDEN", async (role) => {
    const findMany = vi.fn();
    const findFirst = vi.fn();
    const session = createTestSession({ id: `${role}-1`, role });
    const caller = createCaller(
      await createTestContext({ session, db: { order: { findMany, findFirst } } }),
    );
    await expect(caller.orders.mine({})).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.orders.detail({ id: "o1" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(findMany).not.toHaveBeenCalled();
    expect(findFirst).not.toHaveBeenCalled();
  });

  it("validates the input with BAD_REQUEST", async () => {
    const caller = createCaller(await createTestContext({ session: resident }));
    await expect(caller.orders.detail({ id: "  " })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    await expect(caller.orders.mine({ limit: 51 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("lists only the caller's non-draft orders, newest first", async () => {
    const findMany = vi.fn(() => Promise.resolve([orderRow]));
    const caller = createCaller(
      await createTestContext({ session: resident, db: { order: { findMany } } }),
    );

    const page = await caller.orders.mine({ cursor: "o9" });

    expect(page).toEqual({
      items: [{ ...orderRow, statusLabel: "Pago validado" }],
      nextCursor: null,
    });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { residentId: "resident-1", status: { not: "draft" } },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 21,
        cursor: { id: "o9", residentId: "resident-1" },
        skip: 1,
      }),
    );
  });

  it("reads the detail filtered by the session owner and never selects the actor id", async () => {
    const findFirst = vi.fn(() => Promise.resolve(detailRow));
    const caller = createCaller(
      await createTestContext({ session: resident, db: { order: { findFirst } } }),
    );

    const detail = await caller.orders.detail({ id: "o1" });

    const [query] = findFirst.mock.calls[0] as unknown as [
      { where: unknown; select: { events: { select: Record<string, boolean> } } },
    ];
    expect(query.where).toEqual({ id: "o1", residentId: "resident-1" });
    expect(Object.keys(query.select.events.select)).not.toContain("actorId");
    expect(detail.delivery).toEqual({
      sector: "Villa Sintética",
      addressReference: "Pasaje Ficticio 123",
      contactAlias: "Vecina Prueba",
      instructions: null,
    });
    expect(detail.timeline.map((entry) => entry.label)).toEqual([
      "Borrador",
      "Pendiente de pago",
      "Pago validado",
    ]);
  });

  it("answers NOT_FOUND when the order is not the caller's (HU-09 #2)", async () => {
    const findFirst = vi.fn(() => Promise.resolve(null));
    const caller = createCaller(
      await createTestContext({ session: resident, db: { order: { findFirst } } }),
    );
    await expect(caller.orders.detail({ id: "order-of-someone-else" })).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "No encontramos ese pedido.",
    });
  });
});
