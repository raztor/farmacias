import { TRPCError } from "@trpc/server";

import { isAdminRole } from "../lib/role";
import { baseProcedure } from "./init";
import { errorMappingMiddleware, loggingMiddleware } from "./middlewares";

/** Anonymous access. Every call is logged and its errors are normalized. */
export const publicProcedure = baseProcedure.use(loggingMiddleware).use(errorMappingMiddleware);

/** Requires a session. Adds non-null `session` and `user` to the context. */
export const protectedProcedure = publicProcedure.use(({ ctx, next }) => {
  if (!ctx.session) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Debes iniciar sesión para continuar." });
  }
  return next({ ctx: { session: ctx.session, user: ctx.session.user } });
});

/** Requires a session whose user has the `admin` role. */
export const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!isAdminRole(ctx.user.role)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "No tienes permisos para realizar esta acción.",
    });
  }
  return next();
});
