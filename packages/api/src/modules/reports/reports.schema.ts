import type { OrderStatus } from "@repo/shared";
import { z } from "zod";

import type { AlertsResult } from "../inventory";
import { INVALID_DAY_MESSAGE, isCalendarDay, rangeProblem } from "./reports-range";

/** Products listed in the "most dispensed" ranking (R-REP-02). */
export const TOP_PRODUCTS_LIMIT = 10;

/** A calendar day in Chile, "YYYY-MM-DD" (the value of an `<input type="date">`). */
const reportDaySchema = z.string().trim().refine(isCalendarDay, INVALID_DAY_MESSAGE);

/**
 * `reports.summary` input (R-REP-04): both ends are optional (default: the last 30 days in
 * Chile). When both are sent they must be ordered and cover at most one year.
 */
export const reportsSummaryInput = z
  .object({ from: reportDaySchema.optional(), to: reportDaySchema.optional() })
  .superRefine(({ from, to }, context) => {
    if (from === undefined || to === undefined) return;
    const problem = rangeProblem(from, to);
    if (problem)
      context.addIssue({ code: "custom", path: [problem.field], message: problem.message });
  });

export type ReportsSummaryInput = z.output<typeof reportsSummaryInput>;

/** One product of the "most dispensed" ranking. */
export type DispensedProduct = {
  productId: string;
  sku: string;
  name: string;
  presentation: string;
  units: number;
};

/** Units handed to residents: orders that reached `delivered` within the range (R-REP-01). */
export type DispensedReport = {
  units: number;
  orders: number;
  /** Most units first (ties by product id); at most {@link TOP_PRODUCTS_LIMIT}. */
  topProducts: DispensedProduct[];
};

export type OrderStatusCount = { status: OrderStatus; count: number };

/** Orders placed within the range, by current status, drafts excluded (R-REP-02). */
export type OrdersByStatusReport = {
  /** Every non-draft status, in state-machine order, zero when there are none. */
  items: OrderStatusCount[];
  total: number;
};

/** `reports.summary` output: only aggregated figures, never personal data (R-REP-07). */
export type ReportsSummary = {
  /** The range actually used (defaults applied): inclusive calendar days in Chile. */
  range: { from: string; to: string };
  dispensed: DispensedReport;
  ordersByStatus: OrdersByStatusReport;
  /** Current low-stock alerts (D-27), the same list as `inventory.alerts` (R-REP-06). */
  lowStock: AlertsResult;
};
