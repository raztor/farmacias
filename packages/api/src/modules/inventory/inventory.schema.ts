import {
  lowStockThresholdSchema,
  paginationSchema,
  stockAdjustmentSchema,
  type ActorRole,
  type StockChangeKind,
  type StockMovementReason,
} from "@repo/shared";
import { z } from "zod";

/** Same bound as the users search of the back office. */
export const INVENTORY_SEARCH_MAX_LENGTH = 100;

/** Low-stock alerts returned at once (D-27); the count is always exact. */
export const ALERTS_MAX_ITEMS = 200;

const productIdSchema = z.string().trim().min(1, { error: "Selecciona un producto." }).max(64, {
  error: "Identificador de producto demasiado largo.",
});

/**
 * Input of `inventory.list`: cursor pagination, an optional text search (name, active
 * ingredient, presentation or SKU) and `onlyLow` (stock at or under the threshold).
 */
export const listInventoryInput = paginationSchema.extend({
  search: z
    .string()
    .trim()
    .max(INVENTORY_SEARCH_MAX_LENGTH, { error: "La búsqueda es demasiado larga." })
    .optional(),
  onlyLow: z.boolean().optional(),
});
export type ListInventoryInput = z.output<typeof listInventoryInput>;

/** Input of `inventory.adjust` (HU-10, D-25), shared with the admin form. */
export const adjustStockInput = stockAdjustmentSchema;
export type AdjustStockInput = z.output<typeof adjustStockInput>;

/** Input of `inventory.movements`: one product's ledger, newest first. */
export const movementsInput = paginationSchema.extend({ productId: productIdSchema });
export type MovementsInput = z.output<typeof movementsInput>;

/** Input of `inventory.product`: the stock card of one product. */
export const inventoryProductInput = z.object({ productId: productIdSchema });

/** Input of `inventory.setThreshold` (HU-12, D-26). */
export const setThresholdInput = z.object({
  productId: productIdSchema,
  threshold: lowStockThresholdSchema,
});
export type SetThresholdInput = z.output<typeof setThresholdInput>;

export type StockLevel = "available" | "low" | "out";

/** One product's stock as the back office sees it. */
export type InventoryItemView = {
  productId: string;
  sku: string;
  name: string;
  presentation: string;
  active: boolean;
  onHand: number;
  lowStockThreshold: number;
  level: StockLevel;
};

export type ListInventoryResult = {
  items: InventoryItemView[];
  /** Pass it back as `cursor` to get the next page; `null` on the last page. */
  nextCursor: string | null;
};

/** One row of a product's stock ledger (`stock_movements`). */
export type StockMovementView = {
  id: string;
  reason: StockMovementReason;
  delta: number;
  quantityBefore: number;
  quantityAfter: number;
  /** Reason typed by the operator (receipts, adjustments) or the cancellation note. */
  note: string | null;
  /** Order of a sale or restore. */
  orderCode: string | null;
  /** `system` when no user made the change (payments); otherwise the user's current role. */
  actorRole: ActorRole;
  actorName: string | null;
  createdAt: Date;
};

export type MovementsResult = { items: StockMovementView[]; nextCursor: string | null };

/** Result of a receipt or adjustment. */
export type StockAdjustmentResult = {
  item: InventoryItemView;
  kind: StockChangeKind;
  delta: number;
  quantityBefore: number;
  quantityAfter: number;
};

export type AlertsResult = {
  /** Out of stock first, then by units on hand (D-27); at most {@link ALERTS_MAX_ITEMS}. */
  items: InventoryItemView[];
  /** Every active product at or under its threshold. */
  total: number;
};
