import { createRouter, operatorProcedure } from "../../trpc";
import { createInventoryAdminServiceFromDeps } from "./inventory-admin.service";
import {
  adjustStockInput,
  inventoryProductInput,
  listInventoryInput,
  movementsInput,
  setThresholdInput,
} from "./inventory.schema";

const inventoryProcedure = operatorProcedure.use(({ ctx, next }) =>
  next({
    ctx: {
      inventory: createInventoryAdminServiceFromDeps(ctx.deps, ctx.logger),
      actor: { actorId: ctx.user.id, actorRole: ctx.role },
    },
  }),
);

/**
 * Back-office stock (HU-10, HU-12; D-25..D-27, D-31): operator or admin only. Residents get
 * FORBIDDEN and anonymous callers UNAUTHORIZED. The actor always comes from the session.
 */
export const inventoryRouter = createRouter({
  list: inventoryProcedure
    .input(listInventoryInput)
    .query(({ ctx, input }) => ctx.inventory.list(input)),

  product: inventoryProcedure
    .input(inventoryProductInput)
    .query(({ ctx, input }) => ctx.inventory.product(input.productId)),

  movements: inventoryProcedure
    .input(movementsInput)
    .query(({ ctx, input }) => ctx.inventory.movements(input)),

  adjust: inventoryProcedure
    .input(adjustStockInput)
    .mutation(({ ctx, input }) => ctx.inventory.adjust(ctx.actor, input)),

  alerts: inventoryProcedure.query(({ ctx }) => ctx.inventory.alerts()),

  setThreshold: inventoryProcedure
    .input(setThresholdInput)
    .mutation(({ ctx, input }) => ctx.inventory.setThreshold(ctx.actor, input)),
});
