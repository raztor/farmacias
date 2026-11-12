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
export {
  type AdminListProductsInput,
  type AdminProduct,
  type AdminProductList,
  type AdminProductStatus,
  type CreateProductInput,
  type UpdateProductInput,
  type CatalogSearchInput,
  type CatalogSearchResult,
  type ProductAvailability,
  type ProductByIdInput,
  type ProductSummary,
} from "./modules/catalog";
export { type HealthStatus } from "./modules/health";
// Ordering services for trusted server code (seed scripts); clients use the tRPC router.
export {
  createOrderTransitionServiceFromDeps,
  createOrdersServiceFromDeps,
  type AddItemInput,
  type AppliedTransition,
  type CancelInput,
  type ConfirmInput,
  type DeliveryDetails,
  type OrderDraft,
  type OrderDraftLine,
  type OrderSummary,
  type OrderTransitionService,
  type OrdersService,
  type RemoveItemInput,
  type RepeatChange,
  type RepeatChangeReason,
  type RepeatResult,
  type SetFulfillmentInput,
  type SetQuantityInput,
  type TransitionActor,
} from "./modules/orders";
export {
  createPaymentsServiceFromDeps,
  type PayInput,
  type PaymentResult,
  type PaymentScenario,
  type PaymentsService,
  type StockConflictProduct,
} from "./modules/payments";
export { type AuditEntry, type ListAuditInput, type ListAuditResult } from "./modules/audit";
export { type UpdateProfileInput, type UserProfile } from "./modules/user";
export {
  type MyOrderDetail,
  type MyOrderItem,
  type MyOrdersInput,
  type MyOrdersResult,
  type OrderDetailInput,
  type TimelineEntry,
} from "./modules/tracking";
export {
  type OperationsDelivery,
  type OperationsHistoryEntry,
  type OperationsOrderDetail,
  type OperationsOrderLine,
  type OperatorTarget,
  type QueueItem,
  type QueueResult,
  type QueueStatus,
} from "./modules/operations";

/** Inputs of every procedure, e.g. `RouterInputs["admin"]["listUsers"]`. */
export type RouterInputs = inferRouterInputs<AppRouter>;
/** Outputs of every procedure, e.g. `RouterOutputs["user"]["me"]`. */
export type RouterOutputs = inferRouterOutputs<AppRouter>;
