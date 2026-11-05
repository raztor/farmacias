import { adminProcedure, createRouter } from "../../trpc";
import { listAuditInput } from "./audit.schema";
import { createAuditServiceFromDeps } from "./audit.service";

/** Audit review (admin only, R-AUD-06). Operators and residents get FORBIDDEN. */
export const auditRouter = createRouter({
  list: adminProcedure
    .input(listAuditInput)
    .query(({ ctx, input }) => createAuditServiceFromDeps(ctx.deps).list(input)),
});
