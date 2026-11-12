import { TRPCError } from "@trpc/server";
import { describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";

import { createCaller } from "../../root";
import { createTestContext, createTestSession, type FakeDb } from "../../testing/fakes";

const resident = createTestSession({ id: "resident-1", role: "resident" });
const operator = createTestSession({ id: "operator-1", role: "operator" });
const admin = createTestSession({ id: "admin-1", role: "admin" });

const KEY = "0b8f6c1e-6a52-4f7e-9d43-2f1c8a7e5b10";

const rejectionOf = async (promise: Promise<unknown>): Promise<TRPCError> => {
  try {
    await promise;
  } catch (error) {
    if (error instanceof TRPCError) return error;
    throw error;
  }
  throw new Error("expected a rejection");
};

describe("orders and payments routers", () => {
  it("rejects anonymous callers with UNAUTHORIZED", async () => {
    const caller = createCaller(await createTestContext());
    await expect(caller.orders.draft()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(
      caller.payments.pay({ orderId: "o1", idempotencyKey: KEY, scenario: "approve" }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it.each([
    ["operator", operator],
    ["admin", admin],
  ])("rejects %s sessions with FORBIDDEN (resident app only)", async (_role, session) => {
    const $transaction = vi.fn();
    const caller = createCaller(await createTestContext({ session, db: { $transaction } }));
    await expect(caller.orders.addItem({ productId: "p1", quantity: 1 })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(
      caller.payments.pay({ orderId: "o1", idempotencyKey: KEY, scenario: "approve" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.orders.repeat({ orderId: "o1" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect($transaction).not.toHaveBeenCalled();
  });

  it("repeats only the session resident's orders (HU-14, D-10)", async () => {
    const findUnique = vi.fn(() =>
      Promise.resolve({ id: "o1", residentId: "resident-2", status: "delivered", lines: [] }),
    );
    const db: Record<string, unknown> = { order: { findUnique } };
    db.$transaction = (run: (tx: unknown) => unknown) => run(db);
    const caller = createCaller(
      await createTestContext({ session: resident, db: db as unknown as FakeDb }),
    );

    await expect(caller.orders.repeat({ orderId: "o1" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(caller.orders.repeat({ orderId: " " })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(findUnique).toHaveBeenCalledTimes(1);
  });

  it("identifies the missing delivery field with BAD_REQUEST (HU-04 #2)", async () => {
    const caller = createCaller(await createTestContext({ session: resident }));
    const error = await rejectionOf(
      caller.orders.setFulfillment({
        type: "delivery",
        sector: "Villa Sintética",
        addressReference: "Pasaje Ficticio 123",
        contactAlias: "",
      }),
    );
    expect(error.code).toBe("BAD_REQUEST");
    expect(error.cause).toBeInstanceOf(ZodError);
    expect((error.cause as ZodError).issues[0]).toMatchObject({
      path: ["contactAlias"],
      message: "Indica un alias de contacto",
    });
  });

  it("reads the draft of the session's resident only", async () => {
    const findFirst = vi.fn(() => Promise.resolve(null));
    const db = { order: { findFirst } } as unknown as FakeDb;
    const caller = createCaller(await createTestContext({ session: resident, db }));

    await expect(caller.orders.draft()).resolves.toBeNull();
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { residentId: "resident-1", status: "draft" } }),
    );
  });

  it("answers NOT_FOUND when paying another account's order (owner comes from the session)", async () => {
    const order = {
      id: "o1",
      code: "P-000001",
      residentId: "resident-2",
      status: "pending_payment",
      version: 0,
      fulfillment: "pickup",
      totalClp: 1990,
      updatedAt: new Date(),
    };
    const db: Record<string, unknown> = { $queryRaw: vi.fn(() => Promise.resolve([order])) };
    db.$transaction = (run: (tx: unknown) => unknown) => run(db);
    const caller = createCaller(
      await createTestContext({ session: resident, db: db as unknown as FakeDb }),
    );

    await expect(
      caller.payments.pay({ orderId: "o1", idempotencyKey: KEY, scenario: "approve" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND", message: "No encontramos ese pedido." });
  });
});
