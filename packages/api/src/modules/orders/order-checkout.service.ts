import type { AppLogger } from "@repo/shared";

import { staleVersionError } from "../order-status";
import { applyTransition } from "./order-transition.service";
import { lineTotalClp, orderTotalClp } from "./order-totals";
import { toOrderSummary } from "./order-views";
import {
  draftNotFoundError,
  emptyOrderError,
  incompleteFulfillmentError,
  insufficientStockError,
  orderNotFoundError,
  productsUnavailableError,
} from "./orders.errors";
import type { DraftLineRecord, DraftRecord, OrdersRepository, OrdersTx } from "./orders.repository";
import type { CancelInput, ConfirmInput, OrderSummary } from "./orders.schema";

export type CheckoutService = {
  /** HU-04: `draft → pending_payment` with prices refreshed and the total recomputed. */
  confirm: (command: ConfirmInput & { residentId: string }) => Promise<OrderSummary>;
  /** Owner cancellation (draft, pending/rejected payment, or paid: restores stock). */
  cancel: (command: CancelInput & { residentId: string }) => Promise<OrderSummary>;
};

const hasValidFulfillment = (draft: DraftRecord): boolean =>
  draft.fulfillment === "pickup" || (draft.fulfillment === "delivery" && draft.delivery !== null);

/** Re-validates every line against the catalog and the stock on hand (R-ORD-10). */
const assertLinesAvailable = (lines: readonly DraftLineRecord[]): void => {
  const inactive = lines.filter((line) => !line.active);
  if (inactive.length > 0) {
    throw productsUnavailableError(
      inactive.map(({ productId, commercialName }) => ({ productId, commercialName })),
    );
  }
  const short = lines.filter((line) => line.quantity > line.onHand);
  if (short.length > 0) {
    throw insufficientStockError(
      short.map((line) => ({
        productId: line.productId,
        commercialName: line.commercialName,
        requested: line.quantity,
        available: line.onHand,
      })),
    );
  }
};

/** Refreshes each line to the current catalog price (R-ORD-11); returns the new total. */
const refreshPrices = async (tx: OrdersTx, draft: DraftRecord): Promise<number> => {
  const lines = draft.lines.map((line) => ({ ...line, unitPriceClp: line.currentPriceClp }));
  for (const line of lines) {
    const original = draft.lines.find((current) => current.productId === line.productId);
    if (original?.unitPriceClp === line.unitPriceClp) continue;
    await tx.saveLine({
      orderId: draft.id,
      productId: line.productId,
      quantity: line.quantity,
      unitPriceClp: line.unitPriceClp,
      lineTotalClp: lineTotalClp(line),
    });
  }
  return orderTotalClp(lines);
};

const lockOwnOrder = async (tx: OrdersTx, orderId: string, residentId: string) => {
  const order = await tx.transitions.lockOrder(orderId);
  if (order?.residentId !== residentId) throw orderNotFoundError();
  return order;
};

export const createCheckoutService = ({
  repo,
  logger,
}: {
  repo: OrdersRepository;
  logger: AppLogger;
}): CheckoutService => ({
  confirm: async ({ residentId, expectedVersion }) => {
    const summary = await repo.transaction(async (tx) => {
      const draft = await tx.lockDraft(residentId);
      if (!draft) throw draftNotFoundError();
      if (draft.version !== expectedVersion) throw staleVersionError();
      if (draft.lines.length === 0) throw emptyOrderError();
      if (!hasValidFulfillment(draft)) throw incompleteFulfillmentError();
      assertLinesAvailable(draft.lines);
      const totalClp = await refreshPrices(tx, draft);
      const order = await lockOwnOrder(tx, draft.id, residentId);
      const applied = await applyTransition(tx, {
        order,
        to: "pending_payment",
        actor: { id: residentId, role: "resident" },
        expectedVersion,
        totalClp,
      });
      return toOrderSummary(applied.order);
    });
    logger.info({ orderId: summary.id, totalClp: summary.totalClp }, "Order confirmed");
    return summary;
  },

  cancel: async ({ residentId, id, expectedVersion, note }) => {
    const summary = await repo.transaction(async (tx) => {
      const order = await lockOwnOrder(tx, id, residentId);
      const applied = await applyTransition(tx, {
        order,
        to: "cancelled",
        actor: { id: residentId, role: "resident" },
        expectedVersion,
        note: note ?? null,
      });
      return toOrderSummary(applied.order);
    });
    logger.info({ orderId: summary.id }, "Order cancelled by its resident");
    return summary;
  },
});
