import { adminRouter } from "./modules/admin";
import { healthRouter } from "./modules/health";
import { userRouter } from "./modules/user";
import { createCallerFactory, createRouter } from "./trpc";

export const appRouter = createRouter({
  health: healthRouter,
  user: userRouter,
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;

/** Server-side caller (RSC, scripts, tests): `createCaller(ctx).user.me()`. */
export const createCaller = createCallerFactory(appRouter);
