import { describe, expect, it, vi } from "vitest";

import { createCaller } from "../../root";
import { createTestContext, createTestSession, type FakeDb } from "../../testing/fakes";

const resident = createTestSession({ id: "resident-1", role: "resident" });
const operator = createTestSession({ id: "operator-1", role: "operator" });
const admin = createTestSession({ id: "admin-1", role: "admin" });

const TRANSITION = { id: "o1", to: "in_preparation", expectedVersion: 0 } as const;

/** Every operations procedure, called (lazily) through the real router and guards. */
const callAll = (caller: ReturnType<typeof createCaller>) => [
  () => caller.operations.queue({}),
  () => caller.operations.order({ id: "o1" }),
  () => caller.operations.transition(TRANSITION),
];

/** OPS-U04 (docs/specs/operations.md): access control of the back office (HU-07 #2). */
describe("operations router", () => {
  it("rejects anonymous callers with UNAUTHORIZED on every procedure", async () => {
    const caller = createCaller(await createTestContext());
    for (const call of callAll(caller)) {
      await expect(call()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    }
  });

  it("rejects residents with FORBIDDEN on every procedure, before any database access", async () => {
    const findMany = vi.fn();
    const findUnique = vi.fn();
    const $transaction = vi.fn();
    const db = { order: { findMany, findUnique }, $transaction } as unknown as FakeDb;
    const caller = createCaller(await createTestContext({ session: resident, db }));

    for (const call of callAll(caller)) {
      await expect(call()).rejects.toMatchObject({
        code: "FORBIDDEN",
        message: "No tienes permisos para realizar esta acción.",
      });
    }
    expect(findMany).not.toHaveBeenCalled();
    expect(findUnique).not.toHaveBeenCalled();
    expect($transaction).not.toHaveBeenCalled();
  });

  it.each([
    ["operator", operator],
    ["admin", admin],
  ])("lets %s read the queue, never asking for drafts", async (_role, session) => {
    const findMany = vi.fn(() => Promise.resolve([]));
    const db = { order: { findMany } } as unknown as FakeDb;
    const caller = createCaller(await createTestContext({ session, db }));

    await expect(caller.operations.queue({ fulfillment: "pickup" })).resolves.toEqual({
      items: [],
      nextCursor: null,
    });
    const [args] = findMany.mock.calls[0] as unknown as [{ where: { status: { in: string[] } } }];
    expect(args.where).toMatchObject({ fulfillment: "pickup" });
    expect(args.where.status.in).not.toContain("draft");
    expect(args.where.status.in).toHaveLength(9);
  });

  it.each([["payment_validated"], ["payment_rejected"], ["pending_payment"], ["draft"]])(
    "rejects the non-operational target %s with BAD_REQUEST",
    async (to) => {
      const $transaction = vi.fn();
      const caller = createCaller(
        await createTestContext({ session: operator, db: { $transaction } }),
      );
      await expect(
        // @ts-expect-error -- the router must reject targets outside OPERATOR_TARGETS at runtime.
        caller.operations.transition({ ...TRANSITION, to }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      expect($transaction).not.toHaveBeenCalled();
    },
  );

  it("answers NOT_FOUND for an unknown order", async () => {
    const findUnique = vi.fn(() => Promise.resolve(null));
    const db = { order: { findUnique } } as unknown as FakeDb;
    const caller = createCaller(await createTestContext({ session: operator, db }));
    await expect(caller.operations.order({ id: "missing" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});
