import {
  FULFILLMENT_TYPES,
  paginationSchema,
  type ActorRole,
  type FulfillmentType,
  type OrderStatus,
} from "@repo/shared";
import { z } from "zod";

/**
 * Statuses the back office can list and open: every status except `draft` (the resident's cart
 * is private until confirmed, docs/specs/operations.md §2 and R-OPS-02).
 */
export const QUEUE_STATUSES = [
  "pending_payment",
  "payment_validated",
  "payment_rejected",
  "in_preparation",
  "ready_for_pickup",
  "in_transit",
  "delivered",
  "not_delivered",
  "cancelled",
] as const satisfies readonly Exclude<OrderStatus, "draft">[];
export type QueueStatus = (typeof QUEUE_STATUSES)[number];

/** `true` when the back office can see an order in this status (every status but `draft`). */
export const isQueueStatus = (status: OrderStatus): status is QueueStatus => status !== "draft";

/**
 * Destinations `operations.transition` accepts (R-OPS-06): physical progress and operational
 * cancellation. Payment results (system) and confirmation (resident) are rejected by the schema.
 */
export const OPERATOR_TARGETS = [
  "in_preparation",
  "ready_for_pickup",
  "in_transit",
  "delivered",
  "not_delivered",
  "cancelled",
] as const satisfies readonly OrderStatus[];
export type OperatorTarget = (typeof OPERATOR_TARGETS)[number];

const OPERATOR_TARGET_SET: ReadonlySet<OrderStatus> = new Set(OPERATOR_TARGETS);

export const isOperatorTarget = (status: OrderStatus): status is OperatorTarget =>
  OPERATOR_TARGET_SET.has(status);

export const ORDER_CODE_QUERY_MAX_LENGTH = 20;
export const TRANSITION_NOTE_MAX_LENGTH = 200;

const ID_MAX_LENGTH = 64;

const orderIdSchema = z
  .string({ error: "Selecciona un pedido" })
  .trim()
  .min(1, { error: "Selecciona un pedido" })
  .max(ID_MAX_LENGTH, { error: "Identificador de pedido demasiado largo" });

/**
 * Order code search (R-OPS-01): exact code or prefix, case-insensitive. Codes are stored in upper
 * case ("P-000123"), so the term is upper-cased; only letters, digits and dashes are accepted, so
 * it can never carry LIKE wildcards. Blank means "no search".
 */
const codeQuerySchema = z
  .string()
  .trim()
  .max(ORDER_CODE_QUERY_MAX_LENGTH, { error: "El código admite hasta 20 caracteres" })
  .regex(/^[A-Za-z0-9-]*$/, { error: "El código solo puede tener letras, números y guiones" })
  .transform((value) => (value.length === 0 ? undefined : value.toUpperCase()))
  .optional();

/** Input of `operations.queue` (HU-07): filters, FIFO, cursor pagination. */
export const queueInput = paginationSchema.extend({
  /** One or more statuses; omitted or empty means every non-draft status. */
  status: z
    .array(z.enum(QUEUE_STATUSES, { error: "Estado no disponible en la bandeja" }))
    .max(QUEUE_STATUSES.length)
    .optional()
    .transform((statuses) => (statuses?.length ? [...new Set(statuses)] : undefined)),
  fulfillment: z
    .enum(FULFILLMENT_TYPES, { error: "Elige retiro en farmacia o despacho simulado" })
    .optional(),
  q: codeQuerySchema,
});
export type QueueInput = z.output<typeof queueInput>;

/** Input of `operations.order`. */
export const operationsOrderInput = z.object({ id: orderIdSchema });
export type OperationsOrderInput = z.output<typeof operationsOrderInput>;

/** Input of `operations.transition` (HU-08). */
export const transitionInput = z.object({
  id: orderIdSchema,
  to: z.enum(OPERATOR_TARGETS, { error: "Ese cambio de estado no lo registra la operación" }),
  expectedVersion: z.number({ error: "Falta la versión del pedido" }).int().min(0),
  note: z
    .string()
    .trim()
    .max(TRANSITION_NOTE_MAX_LENGTH, { error: "La nota admite hasta 200 caracteres" })
    .optional()
    .transform((value) => (value === undefined || value.length === 0 ? null : value)),
});
export type TransitionInput = z.output<typeof transitionInput>;

/** One row of the back-office queue (R-OPS-03). No payment data or credentials. */
export type QueueItem = {
  id: string;
  code: string;
  status: OrderStatus;
  statusLabel: string;
  /** `null` only for a cart cancelled before choosing a fulfillment. */
  fulfillment: FulfillmentType | null;
  itemCount: number;
  totalClp: number;
  createdAt: Date;
  updatedAt: Date;
};

export type QueueResult = { items: QueueItem[]; nextCursor: string | null };

export type OperationsOrderLine = {
  productId: string;
  commercialName: string;
  presentation: string;
  quantity: number;
  unitPriceClp: number;
  lineTotalClp: number;
};

/** Synthetic delivery data (D-04); only for delivery orders. */
export type OperationsDelivery = {
  sector: string;
  addressReference: string;
  contactAlias: string;
  instructions: string | null;
};

export type OperationsHistoryEntry = {
  /** `null` for the creation event of the order. */
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  toLabel: string;
  actorRole: ActorRole;
  /** Display name of the actor, for internal back-office use (`null` for the system). */
  actorName: string | null;
  note: string | null;
  createdAt: Date;
};

/** `operations.order` / `operations.transition` output (R-OPS-05). */
export type OperationsOrderDetail = QueueItem & {
  version: number;
  lines: OperationsOrderLine[];
  delivery: OperationsDelivery | null;
  /** Oldest first. */
  history: OperationsHistoryEntry[];
  /** Destinations the caller may register now, per the state machine (R-OPS-05, R-OPS-10). */
  allowedTransitions: OperatorTarget[];
};
