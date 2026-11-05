import { createRouter, residentProcedure } from "../../trpc";
import { myOrdersInput, orderDetailInput } from "./tracking.schema";
import { createTrackingServiceFromDeps } from "./tracking.service";

const trackingProcedure = residentProcedure.use(({ ctx, next }) =>
  next({ ctx: { tracking: createTrackingServiceFromDeps(ctx.deps) } }),
);

/**
 * Resident order tracking (HU-09, RF-11). The resident id always comes from the session, never
 * from the input. Exported as a plain record so the root router publishes it in the `orders.*`
 * namespace (`orders.mine`, `orders.detail`) next to the cart procedures.
 */
export const trackingProcedures = {
  mine: trackingProcedure
    .input(myOrdersInput)
    .query(({ ctx, input }) => ctx.tracking.mine(ctx.user.id, input)),

  detail: trackingProcedure
    .input(orderDetailInput)
    .query(({ ctx, input }) => ctx.tracking.detail(ctx.user.id, input.id)),
};

export const trackingRouter = createRouter(trackingProcedures);
