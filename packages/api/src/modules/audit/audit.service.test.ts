import { describe, expect, it, vi } from "vitest";

import type { AuditRepository } from "./audit.repository";
import type { AuditEntry } from "./audit.schema";
import { createAuditService } from "./audit.service";

const entry = (id: string): AuditEntry => ({
  id,
  action: "order.transition",
  entityType: "order",
  entityId: "o1",
  actorRole: "operator",
  actorName: "Operador Demo",
  before: { status: "payment_validated", version: 3 },
  after: { status: "in_preparation", version: 4 },
  createdAt: new Date("2026-11-03T12:00:00.000Z"),
});

describe("audit service", () => {
  it("asks for one extra row and returns the next cursor", async () => {
    const list = vi.fn<AuditRepository["list"]>(() =>
      Promise.resolve([entry("a3"), entry("a2"), entry("a1")]),
    );
    const service = createAuditService({ repo: { list } });

    const page = await service.list({ limit: 2, entityType: "order", entityId: "o1" });

    expect(list).toHaveBeenCalledWith({ take: 3, entityType: "order", entityId: "o1" });
    expect(page.items.map((item) => item.id)).toEqual(["a3", "a2"]);
    expect(page.nextCursor).toBe("a2");
  });

  it("returns a null cursor on the last page", async () => {
    const service = createAuditService({
      repo: { list: () => Promise.resolve([entry("a1")]) },
    });
    await expect(service.list({ limit: 20, action: "stock.sale" })).resolves.toEqual({
      items: [entry("a1")],
      nextCursor: null,
    });
  });
});
