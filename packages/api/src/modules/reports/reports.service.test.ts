import { AppError } from "@repo/shared";
import { describe, expect, it, vi } from "vitest";

import type { AlertsResult } from "../inventory";
import { RANGE_ORDER_MESSAGE } from "./reports-range";
import type { DispensedTotals, ReportsRepository, StatusRow } from "./reports.repository";
import { TOP_PRODUCTS_LIMIT } from "./reports.schema";
import {
  REPORTED_STATUSES,
  createReportsService,
  toDispensed,
  toOrdersByStatus,
} from "./reports.service";

const NOW = new Date("2026-11-12T01:00:00.000Z"); // 2026-11-11 22:00 in Chile

const ALERTS: AlertsResult = {
  items: [
    {
      productId: "p-out",
      sku: "SKU-OUT",
      name: "Paracetamol",
      presentation: "Comprimidos x 16",
      active: true,
      onHand: 0,
      lowStockThreshold: 5,
      level: "out",
    },
  ],
  total: 1,
};

const TOTALS: DispensedTotals = {
  units: 7,
  orders: 3,
  top: [
    { productId: "p1", units: 5 },
    { productId: "p2", units: 2 },
  ],
};

const LABELS = [
  { id: "p2", sku: "SKU-2", name: "Ibuprofeno", presentation: "Cápsulas x 20" },
  { id: "p1", sku: "SKU-1", name: "Losartán", presentation: "Comprimidos x 30" },
];

const fakeRepo = (overrides: Partial<ReportsRepository> = {}) => ({
  dispensed: vi.fn<ReportsRepository["dispensed"]>(() => Promise.resolve(TOTALS)),
  ordersByStatus: vi.fn<ReportsRepository["ordersByStatus"]>(() =>
    Promise.resolve([
      { status: "delivered", count: 3 },
      { status: "pending_payment", count: 2 },
    ]),
  ),
  productLabels: vi.fn<ReportsRepository["productLabels"]>(() => Promise.resolve(LABELS)),
  ...overrides,
});

const serviceWith = (repo: ReportsRepository) => {
  const lowStock = vi.fn(() => Promise.resolve(ALERTS));
  return { service: createReportsService({ repo, lowStock, now: () => NOW }), lowStock };
};

describe("reports service: summary", () => {
  it("aggregates the three sections for the default range (last 30 days in Chile)", async () => {
    const repo = fakeRepo();
    const { service, lowStock } = serviceWith(repo);

    const summary = await service.summary({});

    const window = {
      start: new Date("2026-10-13T03:00:00.000Z"),
      end: new Date("2026-11-12T03:00:00.000Z"),
    };
    expect(repo.dispensed).toHaveBeenCalledWith(window, TOP_PRODUCTS_LIMIT);
    expect(repo.ordersByStatus).toHaveBeenCalledWith(window);
    expect(repo.productLabels).toHaveBeenCalledWith(["p1", "p2"]);
    expect(lowStock).toHaveBeenCalledOnce();
    expect(summary.range).toEqual({ from: "2026-10-13", to: "2026-11-11" });
    expect(summary.dispensed).toEqual({
      units: 7,
      orders: 3,
      topProducts: [
        {
          productId: "p1",
          sku: "SKU-1",
          name: "Losartán",
          presentation: "Comprimidos x 30",
          units: 5,
        },
        {
          productId: "p2",
          sku: "SKU-2",
          name: "Ibuprofeno",
          presentation: "Cápsulas x 20",
          units: 2,
        },
      ],
    });
    expect(summary.ordersByStatus.total).toBe(5);
    expect(summary.lowStock).toBe(ALERTS);
  });

  it("uses the requested range, both ends included", async () => {
    const repo = fakeRepo();
    const { service } = serviceWith(repo);

    const summary = await service.summary({ from: "2026-07-01", to: "2026-07-31" });

    expect(summary.range).toEqual({ from: "2026-07-01", to: "2026-07-31" });
    expect(repo.ordersByStatus).toHaveBeenCalledWith({
      start: new Date("2026-07-01T04:00:00.000Z"),
      end: new Date("2026-08-01T04:00:00.000Z"),
    });
  });

  it("rejects a range opened by one end that ends before it starts, without querying", async () => {
    const repo = fakeRepo();
    const { service, lowStock } = serviceWith(repo);

    const failure = service.summary({ from: "2026-12-01" });

    await expect(failure).rejects.toBeInstanceOf(AppError);
    await expect(failure).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: RANGE_ORDER_MESSAGE,
      details: { reason: "INVALID_RANGE", field: "from" },
    });
    expect(repo.dispensed).not.toHaveBeenCalled();
    expect(lowStock).not.toHaveBeenCalled();
  });

  it("answers zeros when nothing happened in the range", async () => {
    const repo = fakeRepo({
      dispensed: () => Promise.resolve({ units: 0, orders: 0, top: [] }),
      ordersByStatus: () => Promise.resolve([]),
      productLabels: () => Promise.resolve([]),
    });
    const { service } = serviceWith(repo);

    const summary = await service.summary({ from: "2026-11-01", to: "2026-11-01" });

    expect(summary.dispensed).toEqual({ units: 0, orders: 0, topProducts: [] });
    expect(summary.ordersByStatus.total).toBe(0);
    expect(summary.ordersByStatus.items.every((item) => item.count === 0)).toBe(true);
  });

  it("defaults the clock to the current time", async () => {
    const service = createReportsService({
      repo: fakeRepo(),
      lowStock: () => Promise.resolve(ALERTS),
    });
    const summary = await service.summary({});
    expect(summary.range.to >= "2026-01-01").toBe(true);
  });
});

describe("toOrdersByStatus", () => {
  it("lists every status but draft, in state-machine order, zero filled", () => {
    const rows: StatusRow[] = [
      { status: "cancelled", count: 4 },
      { status: "delivered", count: 1 },
    ];
    const report = toOrdersByStatus(rows);
    expect(report.items.map((item) => item.status)).toEqual(REPORTED_STATUSES);
    expect(REPORTED_STATUSES).not.toContain("draft");
    expect(report.items).toContainEqual({ status: "cancelled", count: 4 });
    expect(report.items).toContainEqual({ status: "payment_rejected", count: 0 });
    expect(report.total).toBe(5);
  });

  it("ignores statuses outside the closed list", () => {
    expect(toOrdersByStatus([{ status: "lost", count: 9 }]).total).toBe(0);
  });
});

describe("toDispensed", () => {
  it("keeps the ranking order and skips a product without label", () => {
    const report = toDispensed(
      { units: 9, orders: 2, top: [{ productId: "ghost", units: 4 }, ...TOTALS.top] },
      LABELS,
    );
    expect(report.topProducts.map((product) => product.productId)).toEqual(["p1", "p2"]);
    expect(report.units).toBe(9);
  });
});
