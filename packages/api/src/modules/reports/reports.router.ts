import { adminProcedure, createRouter } from "../../trpc";
import { reportsSummaryInput } from "./reports.schema";
import { createReportsServiceFromDeps } from "./reports.service";

/**
 * Operational reports (HU-13, D-29, D-31 `reports: read`): admin only. Operators and residents
 * get FORBIDDEN, anonymous callers UNAUTHORIZED (R-REP-08).
 */
export const reportsRouter = createRouter({
  summary: adminProcedure
    .input(reportsSummaryInput)
    .query(({ ctx, input }) => createReportsServiceFromDeps(ctx.deps, ctx.logger).summary(input)),
});
