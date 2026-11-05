import { adminRouter } from "./modules/admin";
import { auditRouter } from "./modules/audit";
import { catalogRouter } from "./modules/catalog";
import { healthRouter } from "./modules/health";
import { operationsRouter } from "./modules/operations";
import { ordersProcedures } from "./modules/orders";
import { paymentsRouter } from "./modules/payments";
import { trackingProcedures } from "./modules/tracking";
import { userRouter } from "./modules/user";
import { createCallerFactory, createRouter } from "./trpc";

export const appRouter = createRouter({
  health: healthRouter,
  user: userRouter,
  admin: adminRouter,
  catalog: catalogRouter,
  // Cart/checkout plus tracking (`orders.mine`, `orders.detail`): one `orders.*` surface.
  orders: createRouter({ ...ordersProcedures, ...trackingProcedures }),
  payments: paymentsRouter,
  operations: operationsRouter,
  audit: auditRouter,
});

export type AppRouter = typeof appRouter;

/** Server-side caller (RSC, scripts, tests): `createCaller(ctx).user.me()`. */
export const createCaller = createCallerFactory(appRouter);
