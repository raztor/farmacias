import { describe, expect, it, vi } from "vitest";

import type {
  OrderDetailRecord,
  OrderListRecord,
  StatusEventRecord,
  TrackingRepository,
} from "./tracking.repository";
import { createTrackingService, toTimeline } from "./tracking.service";

const at = (minute: number): Date => new Date(Date.UTC(2026, 10, 3, 12, minute));

const listRecord = (id: string, minute = 0): OrderListRecord => ({
  id,
  code: `P-${id}`,
  status: "payment_validated",
  fulfillment: "pickup",
  totalClp: 3980,
  createdAt: at(minute),
  updatedAt: at(minute + 1),
});

const event = (
  status: StatusEventRecord["status"],
  minute: number,
  actorRole: StatusEventRecord["actorRole"] = "system",
): StatusEventRecord => ({ status, actorRole, note: null, at: at(minute) });

const detailRecord = (events: StatusEventRecord[]): OrderDetailRecord => ({
  ...listRecord("o1"),
  status: "in_preparation",
  version: 4,
  delivery: null,
  lines: [
    {
      productId: "p1",
      commercialName: "Losartán 50 mg",
      presentation: "Comprimidos x 30",
      quantity: 2,
      unitPriceClp: 1990,
      lineTotalClp: 3980,
    },
  ],
  events,
});

const repoWith = (overrides: Partial<TrackingRepository>): TrackingRepository => ({
  listMine: () => Promise.resolve([]),
  findOwned: () => Promise.resolve(null),
  ...overrides,
});

describe("tracking service · detail (HU-09)", () => {
  it("TRK-U01: returns the current status and an ascending timeline with Spanish labels", async () => {
    const findOwned = vi.fn<TrackingRepository["findOwned"]>(() =>
      Promise.resolve(
        detailRecord([
          event("in_preparation", 30, "operator"),
          event("draft", 0, "resident"),
          event("payment_validated", 20),
          event("pending_payment", 10, "resident"),
        ]),
      ),
    );
    const service = createTrackingService({ repo: repoWith({ findOwned }) });

    const detail = await service.detail("resident-1", "o1");

    expect(findOwned).toHaveBeenCalledWith({ residentId: "resident-1", orderId: "o1" });
    expect(detail).toMatchObject({ status: "in_preparation", statusLabel: "En preparación" });
    expect(detail.timeline.map((entry) => [entry.status, entry.label, entry.actorRole])).toEqual([
      ["draft", "Borrador", "resident"],
      ["pending_payment", "Pendiente de pago", "resident"],
      ["payment_validated", "Pago validado", "system"],
      ["in_preparation", "En preparación", "operator"],
    ]);
    expect(detail.lines).toHaveLength(1);
    expect(detail.version).toBe(4);
  });

  it("TRK-U01: timeline entries carry the actor role only, never personal data (R-TRK-02)", async () => {
    const service = createTrackingService({
      repo: repoWith({
        findOwned: () =>
          Promise.resolve(
            detailRecord([{ ...event("in_preparation", 5, "operator"), note: "Pedido armado" }]),
          ),
      }),
    });

    const [entry] = (await service.detail("resident-1", "o1")).timeline;

    expect(Object.keys(entry ?? {}).sort()).toEqual(["actorRole", "at", "label", "note", "status"]);
    expect(entry).toEqual({
      status: "in_preparation",
      label: "En preparación",
      actorRole: "operator",
      note: "Pedido armado",
      at: at(5),
    });
  });

  it("keeps the stored order of events recorded at the same instant (stable sort)", () => {
    const timeline = toTimeline([
      event("payment_rejected", 7),
      event("payment_rejected", 7),
      event("payment_validated", 7),
    ]);
    expect(timeline.map((entry) => entry.status)).toEqual([
      "payment_rejected",
      "payment_rejected",
      "payment_validated",
    ]);
  });

  it("TRK-U02: another account's order and a missing one answer the same NOT_FOUND", async () => {
    const service = createTrackingService({ repo: repoWith({}) });

    const foreign = service.detail("resident-2", "order-of-resident-1");
    const missing = service.detail("resident-2", "does-not-exist");

    await expect(foreign).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "No encontramos ese pedido.",
    });
    await expect(missing).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "No encontramos ese pedido.",
    });
  });
});

describe("tracking service · mine (R-TRK-04)", () => {
  it("TRK-U03: asks the repository for the caller's orders plus one, and returns the next cursor", async () => {
    const listMine = vi.fn<TrackingRepository["listMine"]>(() =>
      Promise.resolve([listRecord("o3", 30), listRecord("o2", 20), listRecord("o1", 10)]),
    );
    const service = createTrackingService({ repo: repoWith({ listMine }) });

    const page = await service.mine("resident-1", { limit: 2, cursor: "o9" });

    expect(listMine).toHaveBeenCalledWith({ residentId: "resident-1", cursor: "o9", take: 3 });
    expect(page.items.map((item) => item.id)).toEqual(["o3", "o2"]);
    expect(page.nextCursor).toBe("o2");
    expect(page.items[0]).toEqual({
      id: "o3",
      code: "P-o3",
      status: "payment_validated",
      statusLabel: "Pago validado",
      fulfillment: "pickup",
      totalClp: 3980,
      createdAt: at(30),
      updatedAt: at(31),
    });
  });

  it("returns a null cursor on the last page", async () => {
    const service = createTrackingService({
      repo: repoWith({ listMine: () => Promise.resolve([listRecord("o1")]) }),
    });
    const page = await service.mine("resident-1", { limit: 20 });
    expect(page).toMatchObject({ nextCursor: null });
    expect(page.items).toHaveLength(1);
  });
});
