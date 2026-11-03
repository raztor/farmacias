import { createRouter, residentProcedure } from "../../trpc";
import { payInput } from "./payments.schema";
import { createPaymentsServiceFromDeps } from "./payments.service";

/** Simulated payment of the caller's own order (HU-05, HU-06). */
export const paymentsRouter = createRouter({
  pay: residentProcedure.input(payInput).mutation(({ ctx, input }) =>
    createPaymentsServiceFromDeps(ctx.deps, ctx.logger).pay({
      ...input,
      residentId: ctx.user.id,
    }),
  ),
});
