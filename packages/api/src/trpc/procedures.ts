import { requireIdentity, requireRole } from "./guards";
import { baseProcedure } from "./init";
import { errorMappingMiddleware, loggingMiddleware } from "./middlewares";

/** Anonymous access. Every call is logged and its errors are normalized. */
export const publicProcedure = baseProcedure.use(loggingMiddleware).use(errorMappingMiddleware);

/**
 * Requires a session (any role). Adds non-null `session`, `user` and the effective `role` to the
 * context. Without a session: UNAUTHORIZED.
 */
export const protectedProcedure = publicProcedure.use(({ ctx, next }) =>
  next({ ctx: requireIdentity(ctx.session) }),
);

/** Requires the `resident` role (resident app). Operators and admins: FORBIDDEN. */
export const residentProcedure = protectedProcedure.use(({ ctx, next }) => {
  requireRole(ctx.role, "resident");
  return next();
});

/** Requires `operator` or `admin` (back office). Residents: FORBIDDEN. */
export const operatorProcedure = protectedProcedure.use(({ ctx, next }) => {
  requireRole(ctx.role, "operational");
  return next();
});

/** Requires `admin` (users, roles, audit). Residents and operators: FORBIDDEN. */
export const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  requireRole(ctx.role, "admin");
  return next();
});
