import { createOneOfGuard } from "./one-of";

/**
 * Why stock changed (`stock_movements.reason`, CHECK `stock_movements_reason_check`):
 * - `sale`: discount when a simulated payment is approved (delta < 0, carries the order).
 * - `cancellation_restore`: automatic restore when a paid order is cancelled (delta > 0).
 * - `receipt` / `adjustment`: manual operations (Should HU-10, not in the Must scope).
 */
export const STOCK_MOVEMENT_REASONS = [
  "sale",
  "cancellation_restore",
  "receipt",
  "adjustment",
] as const;

export type StockMovementReason = (typeof STOCK_MOVEMENT_REASONS)[number];

export const isStockMovementReason = createOneOfGuard(STOCK_MOVEMENT_REASONS);

/** Default `inventory_items.low_stock_threshold`: availableQty <= 5 shows as "low". */
export const DEFAULT_LOW_STOCK_THRESHOLD = 5;
