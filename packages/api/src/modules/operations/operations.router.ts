import { createRouter, operatorProcedure } from "../../trpc";
import { operationsOrderInput, queueInput, transitionInput } from "./operations.schema";
import { createOperationsServiceFromDeps } from "./operations.service";

const operationsProcedure = operatorProcedure.use(({ ctx, next }) =>
  next({
    ctx: {
      operations: createOperationsServiceFromDeps(ctx.deps, ctx.logger),
      actor: { id: ctx.user.id, role: ctx.role },
    },
  }),
);

/**
 * Back office (HU-07, HU-08): operator or admin only. Residents get FORBIDDEN and anonymous
 * callers UNAUTHORIZED (R-OPS-04). The actor always comes from the session, never the input.
 */
export const operationsRouter = createRouter({
  queue: operationsProcedure
    .input(queueInput)
    .query(({ ctx, input }) => ctx.operations.queue(ctx.actor, input)),

  order: operationsProcedure
    .input(operationsOrderInput)
    .query(({ ctx, input }) => ctx.operations.order(ctx.actor, input.id)),

  transition: operationsProcedure
    .input(transitionInput)
    .mutation(({ ctx, input }) => ctx.operations.transition(ctx.actor, input)),
});
