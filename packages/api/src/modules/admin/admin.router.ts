import { adminProcedure, createRouter } from "../../trpc";
import { listUsersInput, setRoleInput } from "./admin.schema";
import { createAdminServiceFromDeps } from "./admin.service";

const adminServiceProcedure = adminProcedure.use(({ ctx, next }) =>
  next({ ctx: { adminService: createAdminServiceFromDeps(ctx.deps, ctx.logger) } }),
);

export const adminRouter = createRouter({
  stats: adminServiceProcedure.query(({ ctx }) => ctx.adminService.stats()),

  listUsers: adminServiceProcedure
    .input(listUsersInput)
    .query(({ ctx, input }) => ctx.adminService.listUsers(input)),

  setRole: adminServiceProcedure
    .input(setRoleInput)
    .mutation(({ ctx, input }) => ctx.adminService.setRole({ ...input, actorId: ctx.user.id })),
});
