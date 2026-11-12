import { Prisma, type PrismaClient } from "@repo/db";
import { isStockMovementReason, toRole, type ActorRole } from "@repo/shared";

import { INTERACTIVE_TRANSACTION_OPTIONS } from "../../lib/transactions";
import { createAuditWriter } from "../audit";
import { createInventoryStore } from "./inventory.repository";
import type { ListCursor, MovementCursor } from "./inventory-cursor";
import type { InventoryItemView, StockMovementView } from "./inventory.schema";
import type { InventoryDeps } from "./inventory.service";

/** A product's stock row without the computed level. */
export type InventoryRecord = Omit<InventoryItemView, "level">;

export type InventoryListQuery = {
  take: number;
  /** Sort key of the last row of the previous page: rows strictly after it. */
  cursor?: ListCursor | undefined;
  /** `normalizeSearchText` of the search, matched against `products.search_text`. */
  term?: string | undefined;
  /** The search as typed (trimmed), matched against the SKU. */
  sku?: string | undefined;
  onlyLow: boolean;
};

export type MovementsQuery = {
  productId: string;
  take: number;
  /** Sort key of the last movement of the previous page: older movements only. */
  cursor?: MovementCursor | undefined;
};

/** Read side of the back-office stock (no transaction). */
export type InventoryReader = {
  /** By product name, then id (stable for cursors). */
  list: (query: InventoryListQuery) => Promise<InventoryRecord[]>;
  findItem: (productId: string) => Promise<InventoryRecord | null>;
  /** Newest first, ties by id. */
  movements: (query: MovementsQuery) => Promise<StockMovementView[]>;
  /** Active products with `on_hand <= low_stock_threshold`, out of stock first (D-27). */
  alerts: (take: number) => Promise<{ items: InventoryRecord[]; total: number }>;
};

export type LockedThreshold = { onHand: number; lowStockThreshold: number };

/** Threshold writes, bound to one transaction. */
export type ThresholdStore = {
  /** `SELECT ... FOR UPDATE` of the inventory row; `null` when the product has none. */
  lockThreshold: (productId: string) => Promise<LockedThreshold | null>;
  updateThreshold: (productId: string, threshold: number) => Promise<void>;
};

export type InventoryAdminTx = InventoryDeps & { thresholds: ThresholdStore };

export type InventoryAdminRunner = {
  transaction: <T>(run: (tx: InventoryAdminTx) => Promise<T>) => Promise<T>;
};

const ITEM_SELECT = {
  productId: true,
  onHand: true,
  lowStockThreshold: true,
  product: { select: { sku: true, commercialName: true, presentation: true, active: true } },
} satisfies Prisma.InventoryItemSelect;

type ItemRow = Prisma.InventoryItemGetPayload<{ select: typeof ITEM_SELECT }>;

const toRecord = ({ product, ...row }: ItemRow): InventoryRecord => ({
  productId: row.productId,
  sku: product.sku,
  name: product.commercialName,
  presentation: product.presentation,
  active: product.active,
  onHand: row.onHand,
  lowStockThreshold: row.lowStockThreshold,
});

const BY_NAME: Prisma.InventoryItemOrderByWithRelationInput[] = [
  { product: { commercialName: "asc" } },
  { productId: "asc" },
];

/** `on_hand <= low_stock_threshold` (column against column). */
const lowStockWhere = (db: PrismaClient): Prisma.InventoryItemWhereInput => ({
  onHand: { lte: db.inventoryItem.fields.lowStockThreshold },
});

const searchWhere = ({ term, sku }: InventoryListQuery): Prisma.InventoryItemWhereInput => {
  const or: Prisma.ProductWhereInput[] = [
    ...(term ? [{ searchText: { contains: term } }] : []),
    ...(sku ? [{ sku: { contains: sku, mode: "insensitive" as const } }] : []),
  ];
  return or.length === 0 ? {} : { product: { OR: or } };
};

/** Keyset condition: (name, id) strictly after the cursor, in `BY_NAME` order. */
const afterListCursor = (cursor: ListCursor | undefined): Prisma.InventoryItemWhereInput =>
  cursor
    ? {
        OR: [
          { product: { commercialName: { gt: cursor.name } } },
          { product: { commercialName: cursor.name }, productId: { gt: cursor.productId } },
        ],
      }
    : {};

/** Keyset condition: (createdAt, id) strictly before the cursor (newest first). */
const beforeMovementCursor = (
  cursor: MovementCursor | undefined,
): Prisma.StockMovementWhereInput =>
  cursor
    ? {
        OR: [
          { createdAt: { lt: cursor.createdAt } },
          { createdAt: cursor.createdAt, id: { lt: cursor.id } },
        ],
      }
    : {};

const MOVEMENT_SELECT = {
  id: true,
  reason: true,
  delta: true,
  quantityBefore: true,
  quantityAfter: true,
  note: true,
  createdAt: true,
  order: { select: { code: true } },
  actor: { select: { name: true, role: true } },
} satisfies Prisma.StockMovementSelect;

type MovementRow = Prisma.StockMovementGetPayload<{ select: typeof MOVEMENT_SELECT }>;

const actorRoleOf = (actor: MovementRow["actor"]): ActorRole =>
  actor === null ? "system" : toRole(actor.role);

const toMovement = ({ order, actor, reason, ...row }: MovementRow): StockMovementView => {
  // stock_movements.reason has a CHECK with the same closed list: anything else is corrupt data.
  if (!isStockMovementReason(reason)) throw new Error(`Unknown stock movement reason "${reason}"`);
  return {
    ...row,
    reason,
    orderCode: order?.code ?? null,
    actorRole: actorRoleOf(actor),
    actorName: actor?.name ?? null,
  };
};

export const createInventoryReader = (db: PrismaClient): InventoryReader => ({
  list: async (query) => {
    const rows = await db.inventoryItem.findMany({
      where: {
        AND: [
          searchWhere(query),
          query.onlyLow ? lowStockWhere(db) : {},
          afterListCursor(query.cursor),
        ],
      },
      orderBy: BY_NAME,
      take: query.take,
      select: ITEM_SELECT,
    });
    return rows.map(toRecord);
  },

  findItem: async (productId) => {
    const row = await db.inventoryItem.findUnique({ where: { productId }, select: ITEM_SELECT });
    return row ? toRecord(row) : null;
  },

  movements: async ({ productId, take, cursor }) => {
    const rows = await db.stockMovement.findMany({
      where: { AND: [{ productId }, beforeMovementCursor(cursor)] },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take,
      select: MOVEMENT_SELECT,
    });
    return rows.map(toMovement);
  },

  alerts: async (take) => {
    const where = { AND: [lowStockWhere(db), { product: { active: true } }] };
    // REPEATABLE READ: both statements read the same snapshot, so the total matches the rows.
    const [rows, total] = await db.$transaction(
      [
        db.inventoryItem.findMany({
          where,
          orderBy: [{ onHand: "asc" }, ...BY_NAME],
          take,
          select: ITEM_SELECT,
        }),
        db.inventoryItem.count({ where }),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    return { items: rows.map(toRecord), total };
  },
});

type ThresholdClient = Pick<Prisma.TransactionClient, "$queryRaw" | "inventoryItem">;

const createThresholdStore = (tx: ThresholdClient): ThresholdStore => ({
  lockThreshold: async (productId) => {
    const rows = await tx.$queryRaw<LockedThreshold[]>`
      SELECT on_hand AS "onHand", low_stock_threshold AS "lowStockThreshold"
      FROM inventory_items WHERE product_id = ${productId}
      FOR UPDATE`;
    return rows[0] ?? null;
  },
  updateThreshold: async (productId, threshold) => {
    await tx.inventoryItem.update({
      where: { productId },
      data: { lowStockThreshold: threshold },
    });
  },
});

/** Runs each write in its own interactive transaction (stock, movement and audit together). */
export const createInventoryAdminRunner = (db: PrismaClient): InventoryAdminRunner => ({
  transaction: (run) =>
    db.$transaction(
      (tx) =>
        run({
          store: createInventoryStore(tx),
          audit: createAuditWriter(tx),
          thresholds: createThresholdStore(tx),
        }),
      INTERACTIVE_TRANSACTION_OPTIONS,
    ),
});
