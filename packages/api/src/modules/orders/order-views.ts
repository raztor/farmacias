import { statusLabel } from "../order-status";
import type { OrderRef } from "./order-transition.service";
import { orderItemCount } from "./order-totals";
import type { DraftRecord } from "./orders.repository";
import type { OrderDraft, OrderSummary } from "./orders.schema";

/** API view of the cart (R-ORD-05): lines, subtotals, total and item count. */
export const toOrderDraft = (draft: DraftRecord): OrderDraft => ({
  id: draft.id,
  code: draft.code,
  status: "draft",
  fulfillment: draft.fulfillment,
  delivery: draft.fulfillment === "delivery" ? draft.delivery : null,
  lines: draft.lines.map((line) => ({
    productId: line.productId,
    commercialName: line.commercialName,
    presentation: line.presentation,
    quantity: line.quantity,
    unitPriceClp: line.unitPriceClp,
    lineTotalClp: line.lineTotalClp,
    availableQty: line.onHand,
  })),
  itemCount: orderItemCount(draft.lines),
  totalClp: draft.totalClp,
  version: draft.version,
});

/** API view of an order after a status change. */
export const toOrderSummary = (order: OrderRef): OrderSummary => ({
  id: order.id,
  code: order.code,
  status: order.status,
  statusLabel: statusLabel(order.status),
  fulfillment: order.fulfillment,
  totalClp: order.totalClp,
  version: order.version,
  updatedAt: order.updatedAt,
});
