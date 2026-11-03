import { createOneOfGuard } from "./one-of";

/**
 * Order statuses (Inception v2.0 §4.6). Stored as TEXT in `orders.status` and in
 * `order_status_events.from_status/to_status`, guarded by CHECK constraints: keep in sync with
 * packages/db/prisma/migrations. Transitions live in the order state machine (@repo/api).
 */
export const ORDER_STATUSES = [
  "draft",
  "pending_payment",
  "payment_validated",
  "payment_rejected",
  "in_preparation",
  "ready_for_pickup",
  "in_transit",
  "delivered",
  "not_delivered",
  "cancelled",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** Spanish (Chile) labels for the UI and the resident timeline. */
export const ORDER_STATUS_LABELS = {
  draft: "Borrador",
  pending_payment: "Pendiente de pago",
  payment_validated: "Pago validado",
  payment_rejected: "Pago rechazado",
  in_preparation: "En preparación",
  ready_for_pickup: "Listo para retiro",
  in_transit: "En ruta",
  delivered: "Entregado",
  not_delivered: "No entregado",
  cancelled: "Cancelado",
} as const satisfies Record<OrderStatus, string>;

export const isOrderStatus = createOneOfGuard(ORDER_STATUSES);

/** Fulfillment modes (`orders.fulfillment`, null while the order is a draft). */
export const FULFILLMENT_TYPES = ["pickup", "delivery"] as const;

export type FulfillmentType = (typeof FULFILLMENT_TYPES)[number];

export const FULFILLMENT_LABELS = {
  pickup: "Retiro en farmacia",
  delivery: "Despacho simulado",
} as const satisfies Record<FulfillmentType, string>;

export const isFulfillmentType = createOneOfGuard(FULFILLMENT_TYPES);

/** Units per order line, enforced by the CHECK `order_lines_quantity_check` (1..99). */
export const ORDER_LINE_MIN_QUANTITY = 1;
export const ORDER_LINE_MAX_QUANTITY = 99;
