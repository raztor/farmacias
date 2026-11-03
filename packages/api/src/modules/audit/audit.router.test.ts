import { describe, expect, it, vi } from "vitest";

import { createCaller } from "../../root";
import { createTestContext, createTestSession } from "../../testing/fakes";

const admin = createTestSession({ id: "admin-1", role: "admin" });

describe("audit router", () => {
  it("rejects anonymous callers with UNAUTHORIZED", async () => {
    const caller = createCaller(await createTestContext());
    await expect(caller.audit.list({})).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it.each(["resident", "operator"] as const)("rejects %s sessions with FORBIDDEN", async (role) => {
    const findMany = vi.fn();
    const session = createTestSession({ id: `${role}-1`, role });
    const caller = createCaller(
      await createTestContext({ session, db: { auditLog: { findMany } } }),
    );
    await expect(caller.audit.list({})).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(findMany).not.toHaveBeenCalled();
  });

  it("lists rows for admins, newest first, with the actor name", async () => {
    const createdAt = new Date("2026-11-03T12:00:00.000Z");
    const findMany = vi.fn(() =>
      Promise.resolve([
        {
          id: "a1",
          action: "stock.sale",
          entityType: "product",
          entityId: "p1",
          actorRole: "system",
          before: { onHand: 3 },
          after: { onHand: 1, orderId: "o1" },
          createdAt,
          actor: null,
        },
      ]),
    );
    const caller = createCaller(
      await createTestContext({ session: admin, db: { auditLog: { findMany } } }),
    );

    const page = await caller.audit.list({ entityType: "product", entityId: "p1", cursor: "a9" });

    expect(page).toEqual({
      items: [
        {
          id: "a1",
          action: "stock.sale",
          entityType: "product",
          entityId: "p1",
          actorRole: "system",
          actorName: null,
          before: { onHand: 3 },
          after: { onHand: 1, orderId: "o1" },
          createdAt,
        },
      ],
      nextCursor: null,
    });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { entityType: "product", entityId: "p1" },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 21,
        cursor: { id: "a9" },
        skip: 1,
      }),
    );
  });

  it("validates the filters", async () => {
    const caller = createCaller(await createTestContext({ session: admin }));
    await expect(caller.audit.list({ entityType: "payment" as "order" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });
});
