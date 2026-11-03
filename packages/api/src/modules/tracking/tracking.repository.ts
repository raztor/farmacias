import type { Prisma, PrismaClient } from "@repo/db";
import {
  isActorRole,
  isFulfillmentType,
  isOrderStatus,
  type ActorRole,
  type FulfillmentType,
  type OrderStatus,
} from "@repo/shared";

import type { MyOrderDelivery, MyOrderLine } from "./tracking.schema";

export type OrderListRecord = {
  id: string;
  code: string;
  status: OrderStatus;
  fulfillment: FulfillmentType | null;
  totalClp: number;
  createdAt: Date;
  updatedAt: Date;
};

/** A status event without any actor identity: only its role is read (R-TRK-02). */
export type StatusEventRecord = {
  status: OrderStatus;
  actorRole: ActorRole;
  note: string | null;
  at: Date;
};

export type OrderDetailRecord = OrderListRecord & {
  version: number;
  delivery: MyOrderDelivery | null;
  lines: MyOrderLine[];
  events: StatusEventRecord[];
};

export type ListMineQuery = { residentId: string; take: number; cursor?: string | undefined };

export type TrackingRepository = {
  /** The resident's non-draft orders, newest first (ties by id, stable for cursors). */
  listMine: (query: ListMineQuery) => Promise<OrderListRecord[]>;
  /** The order only when it belongs to `residentId`; `null` otherwise (D-10). */
  findOwned: (query: { residentId: string; orderId: string }) => Promise<OrderDetailRecord | null>;
};

const LIST_SELECT = {
  id: true,
  code: true,
  status: true,
  fulfillment: true,
  totalClp: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.OrderSelect;

const DETAIL_SELECT = {
  ...LIST_SELECT,
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
  // Never `actorId` nor the `actor` relation: the timeline shows roles, not people (D-19).
  events: {
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { toStatus: true, actorRole: true, note: true, createdAt: true },
  },
} satisfies Prisma.OrderSelect;

type ListRow = Prisma.OrderGetPayload<{ select: typeof LIST_SELECT }>;
type DetailRow = Prisma.OrderGetPayload<{ select: typeof DETAIL_SELECT }>;
type EventRow = DetailRow["events"][number];

/** The CHECK constraints make an unknown value a data corruption: fail loudly. */
const toStatus = (value: string): OrderStatus => {
  if (!isOrderStatus(value)) throw new Error(`Unknown order status "${value}"`);
  return value;
};

const toFulfillment = (value: string | null): FulfillmentType | null => {
  if (value !== null && !isFulfillmentType(value)) {
    throw new Error(`Unknown fulfillment "${value}"`);
  }
  return value;
};

const toActorRole = (value: string): ActorRole => {
  if (!isActorRole(value)) throw new Error(`Unknown actor role "${value}"`);
  return value;
};

const toListRecord = (row: ListRow): OrderListRecord => ({
  id: row.id,
  code: row.code,
  status: toStatus(row.status),
  fulfillment: toFulfillment(row.fulfillment),
  totalClp: row.totalClp,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const toDelivery = (row: DetailRow): MyOrderDelivery | null =>
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

const toEvent = (event: EventRow): StatusEventRecord => ({
  status: toStatus(event.toStatus),
  actorRole: toActorRole(event.actorRole),
  note: event.note,
  at: event.createdAt,
});

const toDetailRecord = (row: DetailRow): OrderDetailRecord => ({
  ...toListRecord(row),
  version: row.version,
  delivery: row.fulfillment === "delivery" ? toDelivery(row) : null,
  lines: row.lines.map((line) => ({
    productId: line.productId,
    commercialName: line.product.commercialName,
    presentation: line.product.presentation,
    quantity: line.quantity,
    unitPriceClp: line.unitPriceClp,
    lineTotalClp: line.lineTotalClp,
  })),
  events: row.events.map(toEvent),
});

export const createTrackingRepository = (db: PrismaClient): TrackingRepository => ({
  listMine: async ({ residentId, take, cursor }) => {
    const rows = await db.order.findMany({
      where: { residentId, status: { not: "draft" } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take,
      // The cursor is scoped to the caller: another account's id positions nothing (D-10).
      ...(cursor ? { cursor: { id: cursor, residentId }, skip: 1 } : {}),
      select: LIST_SELECT,
    });
    return rows.map(toListRecord);
  },
  findOwned: async ({ residentId, orderId }) => {
    // Owner filter in the query itself: another account's order is indistinguishable from a
    // missing one (R-TRK-03).
    const row = await db.order.findFirst({
      where: { id: orderId, residentId },
      select: DETAIL_SELECT,
    });
    return row ? toDetailRecord(row) : null;
  },
});
