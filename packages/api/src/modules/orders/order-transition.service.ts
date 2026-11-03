import { AppError, type ActorRole, type FulfillmentType, type OrderStatus } from "@repo/shared";

import type { AuditWriter } from "../audit";
import { restoreForOrder, type InventoryStore, type RestoreResult } from "../inventory";
import { assertTransition, staleVersionError, stockEffectOf } from "../order-status";
import { orderNotFoundError } from "./orders.errors";

/** Order fields every status transition needs (read under a row lock). */
export type OrderRef = {
  id: string;
  code: string;
  residentId: string;
  status: OrderStatus;
  version: number;
  fulfillment: FulfillmentType | null;
  totalClp: number;
  updatedAt: Date;
};

export type CompareAndSetCommand = {
  orderId: string;
  from: OrderStatus;
  to: OrderStatus;
  expectedVersion: number;
  /** New total stored with the transition (`orders.confirm` refreshes prices). */
  totalClp?: number;
};

export type StatusEventInput = {
  orderId: string;
  from: OrderStatus;
  to: OrderStatus;
  actorId: string | null;
  actorRole: ActorRole;
  note: string | null;
};

/** Persistence of status transitions, bound to one transaction. */
export type TransitionStore = {
  /** `SELECT ... FOR UPDATE` of the order: serializes every change of the same order. */
  lockOrder: (orderId: string) => Promise<OrderRef | null>;
  /**
   * `UPDATE orders SET status = to, version = version + 1 WHERE id AND status = from AND
   * version = expectedVersion`. Returns the updated order, or `null` when nothing matched.
   */
  compareAndSet: (command: CompareAndSetCommand) => Promise<OrderRef | null>;
  insertEvent: (event: StatusEventInput) => Promise<void>;
};

/** Everything a transition writes, bound to the same transaction. */
export type TransitionDeps = {
  transitions: TransitionStore;
  audit: AuditWriter;
  inventory: InventoryStore;
};

/** `id` is `null` for the system (payment results). */
export type TransitionActor = { id: string | null; role: ActorRole };

export type ApplyTransitionCommand = {
  order: OrderRef;
  to: OrderStatus;
  actor: TransitionActor;
  expectedVersion: number;
  note?: string | null;
  /** Set by payments once the stock of the order was discounted in this transaction. */
  stockDiscounted?: boolean;
  totalClp?: number;
};

export type AppliedTransition = { order: OrderRef; restore: RestoreResult | null };

export const isOwnerOf = (order: Pick<OrderRef, "residentId">, actor: TransitionActor): boolean =>
  actor.role === "resident" && actor.id !== null && actor.id === order.residentId;

/**
 * Applies one status transition inside the caller's transaction (R-OST-02..08):
 * 1. the state machine validates it for this actor and fulfillment (else CONFLICT
 *    `INVALID_TRANSITION`, nothing written);
 * 2. compare-and-set on status + version (else CONFLICT `STALE_VERSION`, nothing written);
 * 3. writes the `OrderStatusEvent` and the `order.transition` audit row;
 * 4. applies the stock effect: `payment_validated → cancelled` restores the units sold.
 */
export const applyTransition = async (
  deps: TransitionDeps,
  command: ApplyTransitionCommand,
): Promise<AppliedTransition> => {
  const { order, to, actor } = command;
  assertTransition({
    from: order.status,
    to,
    actorRole: actor.role,
    isOwner: isOwnerOf(order, actor),
    fulfillment: order.fulfillment,
  });
  if (command.expectedVersion !== order.version) throw staleVersionError();
  const effect = stockEffectOf(order.status, to);
  if (effect === "discount" && command.stockDiscounted !== true) {
    throw new AppError("INTERNAL", "Validating a payment requires the stock discount first");
  }
  const updated = await deps.transitions.compareAndSet({
    orderId: order.id,
    from: order.status,
    to,
    expectedVersion: command.expectedVersion,
    ...(command.totalClp === undefined ? {} : { totalClp: command.totalClp }),
  });
  if (!updated) throw staleVersionError();
  const note = command.note ?? null;
  await deps.transitions.insertEvent({
    orderId: order.id,
    from: order.status,
    to,
    actorId: actor.id,
    actorRole: actor.role,
    note,
  });
  await deps.audit.record([
    {
      actorId: actor.id,
      actorRole: actor.role,
      action: "order.transition",
      entityType: "order",
      entityId: order.id,
      before: { status: order.status, version: order.version },
      after: { status: updated.status, version: updated.version, ...(note ? { note } : {}) },
    },
  ]);
  const restore =
    effect === "restore"
      ? await restoreForOrder(
          { store: deps.inventory, audit: deps.audit },
          { orderId: order.id, actor: toStockActor(actor), note },
        )
      : null;
  return { order: updated, restore };
};

const toStockActor = (actor: TransitionActor) => ({ actorId: actor.id, actorRole: actor.role });

/** Runs a function inside one database transaction with the stores bound to it. */
export type TransitionRunner = {
  transaction: <T>(run: (deps: TransitionDeps) => Promise<T>) => Promise<T>;
};

export type TransitionRequest = {
  orderId: string;
  to: OrderStatus;
  actor: TransitionActor;
  expectedVersion: number;
  note?: string | null;
};

export type OrderTransitionService = {
  /**
   * Locks the order and applies one transition (operations back office, cancellations, seed).
   * A resident acting on another account's order gets NOT_FOUND (D-10).
   */
  transition: (request: TransitionRequest) => Promise<AppliedTransition>;
};

export const createOrderTransitionService = ({
  runner,
}: {
  runner: TransitionRunner;
}): OrderTransitionService => ({
  transition: (request) =>
    runner.transaction(async (deps) => {
      const order = await deps.transitions.lockOrder(request.orderId);
      if (!order) throw orderNotFoundError();
      if (request.actor.role === "resident" && !isOwnerOf(order, request.actor)) {
        throw orderNotFoundError();
      }
      return applyTransition(deps, { ...request, order });
    }),
});
