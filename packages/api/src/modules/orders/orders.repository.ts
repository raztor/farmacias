import type { Prisma, PrismaClient } from "@repo/db";
import { isFulfillmentType, type FulfillmentType } from "@repo/shared";

import { INTERACTIVE_TRANSACTION_OPTIONS } from "../../lib/transactions";
import { findRepeatSource, type RepeatSourceRecord } from "./order-repeat.repository";
import { createTransitionDeps } from "./order-transition.repository";
import type { TransitionDeps } from "./order-transition.service";
import type { DeliveryDetails } from "./orders.schema";

export type DraftLineRecord = {
  productId: string;
  commercialName: string;
  presentation: string;
  quantity: number;
  unitPriceClp: number;
  lineTotalClp: number;
  /** Current catalog price (the line keeps its snapshot until it is written or confirmed). */
  currentPriceClp: number;
  active: boolean;
  onHand: number;
};

export type DraftRecord = {
  id: string;
  code: string;
  residentId: string;
  version: number;
  totalClp: number;
  fulfillment: FulfillmentType | null;
  delivery: DeliveryDetails | null;
  lines: DraftLineRecord[];
};

export type ProductStock = {
  id: string;
  commercialName: string;
  presentation: string;
  priceClp: number;
  active: boolean;
  onHand: number;
};

export type LineWrite = {
  orderId: string;
  productId: string;
  quantity: number;
  unitPriceClp: number;
  lineTotalClp: number;
};

export type FulfillmentWrite = { type: "pickup" } | ({ type: "delivery" } & DeliveryDetails);

export type DraftPatch = { totalClp: number; fulfillment?: FulfillmentWrite };

/** Draft data access bound to one transaction, plus the transition stores. */
export type OrdersTx = TransitionDeps & {
  /** Locks the resident's draft row (`FOR UPDATE`) and reads it with its lines. */
  lockDraft: (residentId: string) => Promise<DraftRecord | null>;
  /** Creates the draft (one per resident: unique partial index) and its creation event. */
  createDraft: (residentId: string) => Promise<DraftRecord>;
  loadDraft: (orderId: string) => Promise<DraftRecord>;
  findProduct: (productId: string) => Promise<ProductStock | null>;
  saveLine: (line: LineWrite) => Promise<void>;
  deleteLine: (orderId: string, productId: string) => Promise<boolean>;
  /** Stores the new total (and fulfillment) and bumps the version. */
  updateDraft: (orderId: string, patch: DraftPatch) => Promise<void>;
  /** Any order with its lines and the current catalog data, to repeat it (HU-14). */
  findRepeatSource: (orderId: string) => Promise<RepeatSourceRecord | null>;
};

export type OrdersRepository = {
  transaction: <T>(run: (tx: OrdersTx) => Promise<T>) => Promise<T>;
  /** Read only: the resident's draft, without locking. */
  findDraft: (residentId: string) => Promise<DraftRecord | null>;
};

type Client = Prisma.TransactionClient | PrismaClient;

const DRAFT_SELECT = {
  id: true,
  code: true,
  residentId: true,
  version: true,
  totalClp: true,
  fulfillment: true,
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
      product: {
        select: {
          commercialName: true,
          presentation: true,
          priceClp: true,
          active: true,
          inventory: { select: { onHand: true } },
        },
      },
    },
  },
} satisfies Prisma.OrderSelect;

type DraftRow = Prisma.OrderGetPayload<{ select: typeof DRAFT_SELECT }>;

const toDelivery = (row: DraftRow): DeliveryDetails | null =>
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

const toDraft = (row: DraftRow): DraftRecord => ({
  id: row.id,
  code: row.code,
  residentId: row.residentId,
  version: row.version,
  totalClp: row.totalClp,
  fulfillment: isFulfillmentType(row.fulfillment) ? row.fulfillment : null,
  delivery: toDelivery(row),
  lines: row.lines.map((line) => ({
    productId: line.productId,
    commercialName: line.product.commercialName,
    presentation: line.product.presentation,
    quantity: line.quantity,
    unitPriceClp: line.unitPriceClp,
    lineTotalClp: line.lineTotalClp,
    currentPriceClp: line.product.priceClp,
    active: line.product.active,
    onHand: line.product.inventory?.onHand ?? 0,
  })),
});

const findDraft = async (db: Client, residentId: string): Promise<DraftRecord | null> => {
  const row = await db.order.findFirst({
    where: { residentId, status: "draft" },
    select: DRAFT_SELECT,
  });
  return row ? toDraft(row) : null;
};

const loadDraft = async (db: Client, orderId: string): Promise<DraftRecord> =>
  toDraft(await db.order.findUniqueOrThrow({ where: { id: orderId }, select: DRAFT_SELECT }));

const fulfillmentData = (fulfillment: FulfillmentWrite) => ({
  fulfillment: fulfillment.type,
  deliverySector: fulfillment.type === "delivery" ? fulfillment.sector : null,
  deliveryAddressReference: fulfillment.type === "delivery" ? fulfillment.addressReference : null,
  deliveryContactAlias: fulfillment.type === "delivery" ? fulfillment.contactAlias : null,
  deliveryInstructions: fulfillment.type === "delivery" ? fulfillment.instructions : null,
});

const createOrdersTx = (tx: Prisma.TransactionClient): OrdersTx => ({
  ...createTransitionDeps(tx),
  lockDraft: async (residentId) => {
    const rows = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM orders WHERE resident_id = ${residentId} AND status = 'draft' FOR UPDATE`;
    const row = rows[0];
    return row ? loadDraft(tx, row.id) : null;
  },
  createDraft: async (residentId) => {
    const order = await tx.order.create({ data: { residentId }, select: { id: true } });
    // Creation event (from_status null): the timeline starts at "Borrador".
    await tx.orderStatusEvent.create({
      data: { orderId: order.id, toStatus: "draft", actorId: residentId, actorRole: "resident" },
    });
    return loadDraft(tx, order.id);
  },
  loadDraft: (orderId) => loadDraft(tx, orderId),
  findProduct: async (productId) => {
    const product = await tx.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        commercialName: true,
        presentation: true,
        priceClp: true,
        active: true,
        inventory: { select: { onHand: true } },
      },
    });
    if (!product) return null;
    const { inventory, ...rest } = product;
    return { ...rest, onHand: inventory?.onHand ?? 0 };
  },
  saveLine: async ({ orderId, productId, quantity, unitPriceClp, lineTotalClp }) => {
    const data = { quantity, unitPriceClp, lineTotalClp };
    await tx.orderLine.upsert({
      where: { orderId_productId: { orderId, productId } },
      create: { orderId, productId, ...data },
      update: data,
    });
  },
  deleteLine: async (orderId, productId) =>
    (await tx.orderLine.deleteMany({ where: { orderId, productId } })).count > 0,
  updateDraft: async (orderId, { totalClp, fulfillment }) => {
    await tx.order.update({
      where: { id: orderId },
      data: {
        totalClp,
        version: { increment: 1 },
        ...(fulfillment ? fulfillmentData(fulfillment) : {}),
      },
    });
  },
  findRepeatSource: (orderId) => findRepeatSource(tx, orderId),
});

export const createOrdersRepository = (db: PrismaClient): OrdersRepository => ({
  transaction: (run) =>
    db.$transaction((tx) => run(createOrdersTx(tx)), INTERACTIVE_TRANSACTION_OPTIONS),
  findDraft: (residentId) => findDraft(db, residentId),
});
