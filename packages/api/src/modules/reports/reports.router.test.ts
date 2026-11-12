import { describe, expect, it, vi } from "vitest";

import { createCaller } from "../../root";
import { createTestContext, createTestSession } from "../../testing/fakes";

const admin = createTestSession({ id: "admin-1", role: "admin" });

describe("reports router", () => {
  it("rejects anonymous callers with UNAUTHORIZED", async () => {
    const caller = createCaller(await createTestContext());
    await expect(caller.reports.summary({})).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it.each(["resident", "operator"] as const)(
    "rejects %s sessions with FORBIDDEN without querying",
    async (role) => {
      const groupBy = vi.fn();
      const session = createTestSession({ id: `${role}-1`, role });
      const caller = createCaller(await createTestContext({ session, db: { order: { groupBy } } }));
      await expect(caller.reports.summary({})).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(groupBy).not.toHaveBeenCalled();
    },
  );

  it("validates the range before reaching the database", async () => {
    const groupBy = vi.fn();
    const caller = createCaller(
      await createTestContext({ session: admin, db: { order: { groupBy } } }),
    );
    await expect(
      caller.reports.summary({ from: "2026-11-12", to: "2026-11-11" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      caller.reports.summary({ from: "2025-01-01", to: "2026-11-11" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller.reports.summary({ from: "11-11-2026" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(groupBy).not.toHaveBeenCalled();
  });
});
