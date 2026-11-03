import { createRouter, protectedProcedure } from "../../trpc";
import { createUserServiceFromDeps } from "./user.service";
import { updateProfileInput } from "./user.schema";

const userProcedure = protectedProcedure.use(({ ctx, next }) =>
  next({ ctx: { userService: createUserServiceFromDeps(ctx.deps) } }),
);

export const userRouter = createRouter({
  me: userProcedure.query(({ ctx }) => ctx.userService.me(ctx.user.id)),

  updateProfile: userProcedure
    .input(updateProfileInput)
    .mutation(({ ctx, input }) => ctx.userService.updateProfile(ctx.user.id, input)),
});
