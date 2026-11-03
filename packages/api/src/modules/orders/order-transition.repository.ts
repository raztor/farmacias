import type { Prisma, PrismaClient } from "@repo/db";
import { isFulfillmentType, isOrderStatus } from "@repo/shared";

import { INTERACTIVE_TRANSACTION_OPTIONS } from "../../lib/transactions";
import { createAuditWriter } from "../audit";
import { createInventoryStore } from "../inventory";
import type {
  OrderRef,
  TransitionDeps,
  TransitionRunner,
  TransitionStore,
} from "./order-transition.service";

type OrderRow = Omit<OrderRef, "status" | "fulfillment"> & {
  status: string;
  fulfillment: string | null;
};

/** Narrows a row read with raw SQL; the CHECK constraints make a mismatch a data corruption. */
export const toOrderRef = (row: OrderRow): OrderRef => {
  if (!isOrderStatus(row.status)) throw new Error(`Unknown order status "${row.status}"`);
  const { fulfillment } = row;
  if (fulfillment !== null && !isFulfillmentType(fulfillment)) {
    throw new Error(`Unknown fulfillment "${fulfillment}"`);
  }
  return { ...row, status: row.status, fulfillment };
};

export type TransitionClient = Pick<
  Prisma.TransactionClient,
  "$queryRaw" | "orderStatusEvent" | "auditLog" | "stockMovement"
>;

/** Locks and reads one order (`SELECT ... FOR UPDATE`). */
export const lockOrderRow = async (
  tx: Pick<Prisma.TransactionClient, "$queryRaw">,
  orderId: string,
): Promise<OrderRef | null> => {
  const rows = await tx.$queryRaw<OrderRow[]>`
    SELECT id, code, resident_id AS "residentId", status, version, fulfillment,
           total_clp AS "totalClp", updated_at AS "updatedAt"
    FROM orders WHERE id = ${orderId}
    FOR UPDATE`;
  const row = rows[0];
  return row ? toOrderRef(row) : null;
};

/** Transition store bound to a transaction client. */
export const createTransitionStore = (tx: TransitionClient): TransitionStore => ({
  lockOrder: (orderId) => lockOrderRow(tx, orderId),

  compareAndSet: async ({ orderId, from, to, expectedVersion, totalClp }) => {
    const rows = await tx.$queryRaw<OrderRow[]>`
      UPDATE orders
      SET status = ${to}, version = version + 1, updated_at = now(),
          total_clp = COALESCE(${totalClp ?? null}::int, total_clp)
      WHERE id = ${orderId} AND status = ${from} AND version = ${expectedVersion}
      RETURNING id, code, resident_id AS "residentId", status, version, fulfillment,
                total_clp AS "totalClp", updated_at AS "updatedAt"`;
    const row = rows[0];
    return row ? toOrderRef(row) : null;
  },

  insertEvent: async ({ orderId, from, to, actorId, actorRole, note }) => {
    await tx.orderStatusEvent.create({
      data: { orderId, fromStatus: from, toStatus: to, actorId, actorRole, note },
    });
  },
});

/** Every store a transition writes to, bound to the same transaction client. */
export const createTransitionDeps = (tx: TransitionClient): TransitionDeps => ({
  transitions: createTransitionStore(tx),
  audit: createAuditWriter(tx),
  inventory: createInventoryStore(tx),
});

/** Runs each call in its own interactive transaction. */
export const createTransitionRunner = (db: PrismaClient): TransitionRunner => ({
  transaction: (run) =>
    db.$transaction((tx) => run(createTransitionDeps(tx)), INTERACTIVE_TRANSACTION_OPTIONS),
});
