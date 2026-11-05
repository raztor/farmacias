import type { Prisma, PrismaClient } from "@repo/db";
import {
  isActorRole,
  isFulfillmentType,
  isOrderStatus,
  type ActorRole,
  type FulfillmentType,
  type OrderStatus,
} from "@repo/shared";

import type {
  OperationsDelivery,
  OperationsOrderLine,
  QueueInput,
  QueueStatus,
} from "./operations.schema";

/** Queue query: `statuses` already resolved (never empty, never `draft`). */
export type QueueQuery = Omit<QueueInput, "limit" | "status"> & {
  statuses: readonly QueueStatus[];
  take: number;
};

export type QueueRecord = {
  id: string;
  code: string;
  status: OrderStatus;
  fulfillment: FulfillmentType | null;
  itemCount: number;
  totalClp: number;
  createdAt: Date;
  updatedAt: Date;
};

export type HistoryRecord = {
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  actorRole: ActorRole;
  actorName: string | null;
  note: string | null;
  createdAt: Date;
};

export type OrderDetailRecord = QueueRecord & {
  version: number;
  lines: OperationsOrderLine[];
  delivery: OperationsDelivery | null;
  history: HistoryRecord[];
};

/** Read side of the back office. Writes go through the orders transition service. */
export type OperationsRepository = {
  /**
   * Oldest first by `created_at`, ties by `id` (FIFO, R-OPS-02). `cursor` is the id of the last
   * order of the previous page: rows strictly after it, even if it no longer matches the filters;
   * an id that is not an order yields no rows.
   */
  queue: (query: QueueQuery) => Promise<QueueRecord[]>;
  findOrder: (id: string) => Promise<OrderDetailRecord | null>;
};

const QUEUE_SELECT = {
  id: true,
  code: true,
  status: true,
  fulfillment: true,
  totalClp: true,
  createdAt: true,
  updatedAt: true,
  lines: { select: { quantity: true } },
} satisfies Prisma.OrderSelect;

const DETAIL_SELECT = {
  ...QUEUE_SELECT,
  version: true,
  deliverySector: true,
  deliveryAddressReference: true,
  deliveryContactAlias: true,
  deliveryInstructions: true,
  lines: {
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: {
      productId: true,
      quantity: true,
      unitPriceClp: true,
      lineTotalClp: true,
      product: { select: { commercialName: true, presentation: true } },
    },
  },
  events: {
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: {
      fromStatus: true,
      toStatus: true,
      actorRole: true,
      note: true,
      createdAt: true,
      actor: { select: { name: true } },
    },
  },
} satisfies Prisma.OrderSelect;

type QueueRow = Prisma.OrderGetPayload<{ select: typeof QUEUE_SELECT }>;
type DetailRow = Prisma.OrderGetPayload<{ select: typeof DETAIL_SELECT }>;
type EventRow = DetailRow["events"][number];

/** The CHECK constraints make an unknown value a data corruption, never a user error. */
const toStatus = (value: string): OrderStatus => {
  if (!isOrderStatus(value)) throw new Error(`Unknown order status "${value}"`);
  return value;
};

const toFulfillment = (value: string | null): FulfillmentType | null => {
  if (value === null) return null;
  if (!isFulfillmentType(value)) throw new Error(`Unknown fulfillment "${value}"`);
  return value;
};

const toActorRole = (value: string): ActorRole => {
  if (!isActorRole(value)) throw new Error(`Unknown actor role "${value}"`);
  return value;
};

const toQueueRecord = (row: QueueRow): QueueRecord => ({
  id: row.id,
  code: row.code,
  status: toStatus(row.status),
  fulfillment: toFulfillment(row.fulfillment),
  itemCount: row.lines.reduce((count, line) => count + line.quantity, 0),
  totalClp: row.totalClp,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const toDelivery = (row: DetailRow): OperationsDelivery | null =>
  row.fulfillment === "delivery" &&
  row.deliverySector !== null &&
  row.deliveryAddressReference !== null &&
  row.deliveryContactAlias !== null
    ? {
        sector: row.deliverySector,
        addressReference: row.deliveryAddressReference,
        contactAlias: row.deliveryContactAlias,
        instructions: row.deliveryInstructions,
      }
    : null;

const toHistory = (event: EventRow): HistoryRecord => ({
  fromStatus: event.fromStatus === null ? null : toStatus(event.fromStatus),
  toStatus: toStatus(event.toStatus),
  actorRole: toActorRole(event.actorRole),
  actorName: event.actor?.name ?? null,
  note: event.note,
  createdAt: event.createdAt,
});

const toDetailRecord = (row: DetailRow): OrderDetailRecord => ({
  ...toQueueRecord(row),
  version: row.version,
  delivery: toDelivery(row),
  lines: row.lines.map((line) => ({
    productId: line.productId,
    commercialName: line.product.commercialName,
    presentation: line.product.presentation,
    quantity: line.quantity,
    unitPriceClp: line.unitPriceClp,
    lineTotalClp: line.lineTotalClp,
  })),
  history: row.events.map(toHistory),
});

/** Filters of the queue; uses the `orders(status, fulfillment, created_at)` index. */
const queueWhere = ({ statuses, fulfillment, q }: QueueQuery): Prisma.OrderWhereInput => ({
  status: { in: [...statuses] },
  ...(fulfillment ? { fulfillment } : {}),
  // `q` only holds [A-Z0-9-] (schema), so it cannot carry LIKE wildcards.
  ...(q ? { code: { startsWith: q } } : {}),
});

/**
 * Keyset condition: orders strictly after the cursor order in `(created_at, id)` order, or `null`
 * when the cursor is not an order. The cursor's position is read by id **without** the filters:
 * if the cursor order left the filter between pages (another operator moved it), it still marks
 * where the previous page ended. Prisma's `cursor` + `skip: 1` would instead skip the next
 * matching order (R-OPS-02). The `created_at` of a non-draft order never changes (R-DAT-11).
 */
const afterCursor = async (
  db: PrismaClient,
  cursor: string,
): Promise<Prisma.OrderWhereInput | null> => {
  const at = await db.order.findUnique({
    where: { id: cursor },
    select: { id: true, createdAt: true },
  });
  if (!at) return null;
  return {
    OR: [{ createdAt: { gt: at.createdAt } }, { createdAt: at.createdAt, id: { gt: at.id } }],
  };
};

export const createOperationsRepository = (db: PrismaClient): OperationsRepository => ({
  queue: async ({ cursor, ...query }) => {
    const after = cursor ? await afterCursor(db, cursor) : undefined;
    if (after === null) return [];
    const rows = await db.order.findMany({
      where: after ? { AND: [queueWhere(query), after] } : queueWhere(query),
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: query.take,
      select: QUEUE_SELECT,
    });
    return rows.map(toQueueRecord);
  },

  findOrder: async (id) => {
    const row = await db.order.findUnique({ where: { id }, select: DETAIL_SELECT });
    return row ? toDetailRecord(row) : null;
  },
});
