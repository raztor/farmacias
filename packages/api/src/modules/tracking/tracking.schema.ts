import type { ActorRole, FulfillmentType, OrderStatus } from "@repo/shared";
import { z } from "zod";

/** Page size of «Mis pedidos» (docs/specs/tracking.md §5). */
export const MY_ORDERS_DEFAULT_LIMIT = 20;
export const MY_ORDERS_MAX_LIMIT = 50;

const ORDER_ID_MAX_LENGTH = 64;

const orderIdSchema = z
  .string({ error: "Selecciona un pedido" })
  .trim()
  .min(1, { error: "Selecciona un pedido" })
  .max(ORDER_ID_MAX_LENGTH, { error: "Selecciona un pedido" });

/** Input of `orders.mine`: the caller's own orders, newest first, cursor pagination. */
export const myOrdersInput = z.object({
  cursor: orderIdSchema.optional(),
  limit: z
    .number()
    .int()
    .min(1)
    .max(MY_ORDERS_MAX_LIMIT, {
      error: `Se pueden pedir hasta ${String(MY_ORDERS_MAX_LIMIT)} pedidos por página`,
    })
    .default(MY_ORDERS_DEFAULT_LIMIT),
});
/** What callers send (`limit` optional). */
export type MyOrdersInput = z.input<typeof myOrdersInput>;
/** What the service receives (`limit` always set). */
export type MyOrdersQuery = z.output<typeof myOrdersInput>;

/** Input of `orders.detail`. */
export const orderDetailInput = z.object({ id: orderIdSchema });
export type OrderDetailInput = z.output<typeof orderDetailInput>;

/** One row of «Mis pedidos» (R-TRK-05: the minimum to reach the detail). */
export type MyOrderItem = {
  id: string;
  code: string;
  status: OrderStatus;
  statusLabel: string;
  /** `null` only for a draft cancelled before choosing a fulfillment. */
  fulfillment: FulfillmentType | null;
  totalClp: number;
  createdAt: Date;
  updatedAt: Date;
};

export type MyOrdersResult = {
  items: MyOrderItem[];
  nextCursor: string | null;
};

export type MyOrderLine = {
  productId: string;
  commercialName: string;
  presentation: string;
  quantity: number;
  unitPriceClp: number;
  lineTotalClp: number;
};

export type MyOrderDelivery = {
  sector: string;
  addressReference: string;
  contactAlias: string;
  instructions: string | null;
};

/**
 * One milestone of the timeline (R-TRK-02): status, Spanish label, actor role and note. It never
 * carries the actor's id, name or email (RNF-06, D-19).
 */
export type TimelineEntry = {
  status: OrderStatus;
  label: string;
  actorRole: ActorRole;
  note: string | null;
  at: Date;
};

/** `orders.detail`: the order, its lines and the chronological timeline (HU-09 #1). */
export type MyOrderDetail = MyOrderItem & {
  version: number;
  lines: MyOrderLine[];
  delivery: MyOrderDelivery | null;
  timeline: TimelineEntry[];
};
