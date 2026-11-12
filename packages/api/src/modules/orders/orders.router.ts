import { createRouter, residentProcedure } from "../../trpc";
import {
  addItemInput,
  cancelInput,
  confirmInput,
  removeItemInput,
  repeatInput,
  setFulfillmentInput,
  setQuantityInput,
} from "./orders.schema";
import { createOrdersServiceFromDeps } from "./orders.service";

const ordersProcedure = residentProcedure.use(({ ctx, next }) =>
  next({ ctx: { orders: createOrdersServiceFromDeps(ctx.deps, ctx.logger) } }),
);

/**
 * Resident cart and checkout (HU-03, HU-04). Every procedure acts on the caller's own orders:
 * the resident id always comes from the session, never from the input.
 *
 * Exported as a plain record too, so the root router can publish the tracking procedures
 * (`orders.mine`, `orders.detail`) in the same `orders.*` namespace.
 */
export const ordersProcedures = {
  draft: ordersProcedure.query(({ ctx }) => ctx.orders.draft(ctx.user.id)),

  addItem: ordersProcedure
    .input(addItemInput)
    .mutation(({ ctx, input }) => ctx.orders.addItem({ ...input, residentId: ctx.user.id })),

  setQuantity: ordersProcedure
    .input(setQuantityInput)
    .mutation(({ ctx, input }) => ctx.orders.setQuantity({ ...input, residentId: ctx.user.id })),

  removeItem: ordersProcedure
    .input(removeItemInput)
    .mutation(({ ctx, input }) => ctx.orders.removeItem({ ...input, residentId: ctx.user.id })),

  setFulfillment: ordersProcedure
    .input(setFulfillmentInput)
    .mutation(({ ctx, input }) => ctx.orders.setFulfillment({ ...input, residentId: ctx.user.id })),

  confirm: ordersProcedure
    .input(confirmInput)
    .mutation(({ ctx, input }) => ctx.orders.confirm({ ...input, residentId: ctx.user.id })),

  cancel: ordersProcedure
    .input(cancelInput)
    .mutation(({ ctx, input }) => ctx.orders.cancel({ ...input, residentId: ctx.user.id })),

  // HU-14: adds a previous own order's products to the draft and reports what changed (D-30).
  repeat: ordersProcedure
    .input(repeatInput)
    .mutation(({ ctx, input }) => ctx.orders.repeat({ ...input, residentId: ctx.user.id })),
};

export const ordersRouter = createRouter(ordersProcedures);
