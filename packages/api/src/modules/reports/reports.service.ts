import { AppError, ORDER_STATUSES, isOrderStatus, type AppLogger } from "@repo/shared";

import type { ApiDependencies } from "../../trpc";
import { createInventoryAdminServiceFromDeps, type AlertsResult } from "../inventory";
import { resolveReportRange, type ResolvedRange } from "./reports-range";
import {
  createReportsRepository,
  type DispensedTotals,
  type ProductLabel,
  type ReportsRepository,
  type StatusRow,
} from "./reports.repository";
import {
  TOP_PRODUCTS_LIMIT,
  type DispensedReport,
  type OrdersByStatusReport,
  type ReportsSummary,
  type ReportsSummaryInput,
} from "./reports.schema";

/**
 * Operational reports (HU-13, D-29; docs/specs/reports.md): units dispensed, orders by status and
 * low-stock products for a date range in Chile. Read only and aggregated: no personal data.
 */

export type ReportsDeps = {
  repo: ReportsRepository;
  /** Current low-stock alerts: the inventory module's query (D-27), not a copy of it. */
  lowStock: () => Promise<AlertsResult>;
  /** Clock for the default range (tests pin it). */
  now?: () => Date;
};

export type ReportsService = {
  summary: (input: ReportsSummaryInput) => Promise<ReportsSummary>;
};

/** Statuses counted by "pedidos por estado": every status but the cart (R-REP-02). */
export const REPORTED_STATUSES = ORDER_STATUSES.filter((status) => status !== "draft");

const resolveOrThrow = (input: ReportsSummaryInput, now: Date): ResolvedRange => {
  const resolution = resolveReportRange(input, now);
  if (resolution.ok) return resolution.range;
  const { field, message } = resolution.problem;
  throw new AppError("BAD_REQUEST", message, { details: { reason: "INVALID_RANGE", field } });
};

/** Zero-filled counts in state-machine order; unknown statuses (corrupt rows) are ignored. */
export const toOrdersByStatus = (rows: readonly StatusRow[]): OrdersByStatusReport => {
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (isOrderStatus(row.status)) counts.set(row.status, row.count);
  }
  const items = REPORTED_STATUSES.map((status) => ({ status, count: counts.get(status) ?? 0 }));
  return { items, total: items.reduce((total, item) => total + item.count, 0) };
};

/** Joins the ranking with product labels (a product is never deleted, D-28). */
export const toDispensed = (
  totals: DispensedTotals,
  labels: readonly ProductLabel[],
): DispensedReport => {
  const byId = new Map(labels.map((label) => [label.id, label]));
  const topProducts = totals.top.flatMap(({ productId, units }) => {
    const label = byId.get(productId);
    if (!label) return [];
    return [
      { productId, sku: label.sku, name: label.name, presentation: label.presentation, units },
    ];
  });
  return { units: totals.units, orders: totals.orders, topProducts };
};

export const createReportsService = ({
  repo,
  lowStock,
  now = () => new Date(),
}: ReportsDeps): ReportsService => ({
  summary: async (input) => {
    const range = resolveOrThrow(input, now());
    const window = { start: range.start, end: range.end };
    const [totals, statusRows, alerts] = await Promise.all([
      repo.dispensed(window, TOP_PRODUCTS_LIMIT),
      repo.ordersByStatus(window),
      lowStock(),
    ]);
    const labels = await repo.productLabels(totals.top.map((row) => row.productId));
    return {
      range: { from: range.from, to: range.to },
      dispensed: toDispensed(totals, labels),
      ordersByStatus: toOrdersByStatus(statusRows),
      lowStock: alerts,
    };
  },
});

/** Wires the service to Prisma and to the inventory module's low-stock alerts. */
export const createReportsServiceFromDeps = (
  deps: Pick<ApiDependencies, "db">,
  logger: AppLogger,
): ReportsService => {
  const inventory = createInventoryAdminServiceFromDeps(deps, logger);
  return createReportsService({
    repo: createReportsRepository(deps.db),
    lowStock: () => inventory.alerts(),
  });
};
