import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";

import type { AppRouter } from "./root";

export { appRouter, createCaller, type AppRouter } from "./root";
export {
  createTRPCContext,
  type ApiDependencies,
  type ApiErrorShape,
  type CreateTRPCContextOptions,
  type SessionResolver,
  type TRPCContext,
  type ZodErrorTree,
} from "./trpc";
export {
  type AdminStats,
  type AdminUser,
  type ListUsersInput,
  type ListUsersResult,
  type SetRoleInput,
} from "./modules/admin";
export { type HealthStatus } from "./modules/health";
export { type UpdateProfileInput, type UserProfile } from "./modules/user";

/** Inputs of every procedure, e.g. `RouterInputs["admin"]["listUsers"]`. */
export type RouterInputs = inferRouterInputs<AppRouter>;
/** Outputs of every procedure, e.g. `RouterOutputs["user"]["me"]`. */
export type RouterOutputs = inferRouterOutputs<AppRouter>;
