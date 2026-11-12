import type { Prisma, PrismaClient } from "@repo/db";
import { DEFAULT_LOW_STOCK_THRESHOLD, isProductCategory, type ProductFields } from "@repo/shared";

import { INTERACTIVE_TRANSACTION_OPTIONS } from "../../lib/transactions";
import { createAuditWriter, type AuditWriter } from "../audit";
import type { AdminProduct, AdminProductStatus } from "./catalog-admin.schema";

export type AdminListRepoQuery = {
  /** Distinct words of the term normalized with `normalizeSearchText`; empty lists everything. */
  words: readonly string[];
  status: AdminProductStatus;
  /** Id of the last row of the previous page. */
  cursor?: string | undefined;
  /** Rows to fetch (callers ask for one extra row to detect the next page). */
  take: number;
};

/** Columns written on create and update: the editable fields plus the derived search text. */
export type ProductWrite = ProductFields & { searchText: string };

/** A new product and its initial inventory row (R-CAT-14). */
export type NewProductWrite = ProductWrite & {
  inventory: { onHand: number; lowStockThreshold: number };
};

/** Product writes bound to one transaction. */
export type CatalogAdminStore = {
  insert: (data: NewProductWrite) => Promise<AdminProduct>;
  /** Locks the product row (`FOR UPDATE`) and reads it; `null` when it does not exist. */
  lockById: (id: string) => Promise<AdminProduct | null>;
  update: (id: string, data: ProductWrite) => Promise<AdminProduct>;
};

/** Everything a catalog change writes, bound to the same transaction client (D-22). */
export type CatalogAdminUnitOfWork = { products: CatalogAdminStore; audit: AuditWriter };

export type CatalogAdminRepository = {
  /** Every product (active or not) matching the filters, by commercial name then id. */
  list: (query: AdminListRepoQuery) => Promise<AdminProduct[]>;
  findById: (id: string) => Promise<AdminProduct | null>;
  /** Runs `run` in one interactive transaction: the change and its audit row commit together. */
  transaction: <T>(run: (uow: CatalogAdminUnitOfWork) => Promise<T>) => Promise<T>;
};

const ADMIN_PRODUCT_SELECT = {
  id: true,
  sku: true,
  commercialName: true,
  activeIngredient: true,
  presentation: true,
  category: true,
  priceClp: true,
  active: true,
  updatedAt: true,
  inventory: { select: { onHand: true, lowStockThreshold: true } },
} as const;

type AdminProductRow = Prisma.ProductGetPayload<{ select: typeof ADMIN_PRODUCT_SELECT }>;

export const toAdminProduct = ({ inventory, category, ...row }: AdminProductRow): AdminProduct => {
  // products.category has a CHECK with the same closed list; anything else is corrupt data.
  if (!isProductCategory(category)) throw new Error(`Unknown product category: ${category}`);
  return {
    ...row,
    category,
    onHand: inventory?.onHand ?? 0,
    lowStockThreshold: inventory?.lowStockThreshold ?? DEFAULT_LOW_STOCK_THRESHOLD,
  };
};

const STATUS_FILTER: Readonly<Record<AdminProductStatus, Prisma.ProductWhereInput>> = {
  all: {},
  active: { active: true },
  inactive: { active: false },
};

/** Every word must appear in the search text or in the SKU (R-CAT-15). */
const listWhere = ({ words, status }: AdminListRepoQuery): Prisma.ProductWhereInput => ({
  ...STATUS_FILTER[status],
  AND: words.map((word) => ({
    OR: [
      { searchText: { contains: word } },
      { sku: { contains: word, mode: "insensitive" as const } },
    ],
  })),
});

export type CatalogAdminClient = Pick<
  Prisma.TransactionClient,
  "$queryRaw" | "product" | "auditLog"
>;

/** Product store bound to a transaction client. */
export const createCatalogAdminStore = (tx: CatalogAdminClient): CatalogAdminStore => ({
  insert: async ({ inventory, ...data }) =>
    toAdminProduct(
      await tx.product.create({
        data: { ...data, inventory: { create: inventory } },
        select: ADMIN_PRODUCT_SELECT,
      }),
    ),

  lockById: async (id) => {
    await tx.$queryRaw`SELECT id FROM products WHERE id = ${id} FOR UPDATE`;
    const row = await tx.product.findUnique({ where: { id }, select: ADMIN_PRODUCT_SELECT });
    return row ? toAdminProduct(row) : null;
  },

  update: async (id, data) =>
    toAdminProduct(await tx.product.update({ where: { id }, data, select: ADMIN_PRODUCT_SELECT })),
});

export const createCatalogAdminRepository = (db: PrismaClient): CatalogAdminRepository => ({
  list: async (query) => {
    const rows = await db.product.findMany({
      where: listWhere(query),
      orderBy: [{ commercialName: "asc" }, { id: "asc" }],
      take: query.take,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      select: ADMIN_PRODUCT_SELECT,
    });
    return rows.map(toAdminProduct);
  },

  findById: async (id) => {
    const row = await db.product.findUnique({ where: { id }, select: ADMIN_PRODUCT_SELECT });
    return row ? toAdminProduct(row) : null;
  },

  transaction: (run) =>
    db.$transaction(
      (tx) => run({ products: createCatalogAdminStore(tx), audit: createAuditWriter(tx) }),
      INTERACTIVE_TRANSACTION_OPTIONS,
    ),
});
