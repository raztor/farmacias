import type { ActorRole, StockMovementReason } from "@repo/shared";

import type { AuditEntryInput, AuditWriter } from "../audit";

/**
 * Stock rules (docs/specs/inventory.md). Stock is discounted ONCE, when a simulated payment is
 * approved, and restored automatically only when a paid order is cancelled before preparation
 * (D-02). Every function here runs inside the caller's database transaction: the store and the
 * audit writer are bound to that transaction, so all changes commit or roll back together.
 */

export type StockLine = { productId: string; quantity: number };

export type LockedStock = { productId: string; onHand: number };

export type StockMovementInput = {
  productId: string;
  delta: number;
  reason: StockMovementReason;
  /** Required for `sale` / `cancellation_restore`; `null` for receipts and adjustments. */
  orderId: string | null;
  paymentId: string | null;
  actorId: string | null;
  quantityBefore: number;
  quantityAfter: number;
  note: string | null;
};

export type OrderMovement = { productId: string; delta: number; reason: string };

/** Data access of the inventory, bound to one transaction (see `createInventoryStore`). */
export type InventoryStore = {
  /** Locks the rows (`SELECT ... FOR UPDATE`) in ascending product id order (R-INV-04). */
  lockStock: (productIds: readonly string[]) => Promise<LockedStock[]>;
  /** `UPDATE ... SET on_hand = on_hand - q WHERE on_hand >= q`; new on-hand or `null`. */
  decrement: (line: StockLine) => Promise<number | null>;
  /** Adds units back; returns the new on-hand (`null` when the row does not exist). */
  increment: (line: StockLine) => Promise<number | null>;
  insertMovements: (movements: readonly StockMovementInput[]) => Promise<void>;
  /** Stock movements already written for an order. */
  listOrderMovements: (orderId: string) => Promise<OrderMovement[]>;
};

export type InventoryDeps = { store: InventoryStore; audit: AuditWriter };

export type StockActor = { actorId: string | null; actorRole: ActorRole };

export type StockConflict = { productId: string; requested: number; available: number };

export type DiscountResult =
  { ok: true; movements: StockMovementInput[] } | { ok: false; conflicts: StockConflict[] };

export type DiscountCommand = {
  orderId: string;
  paymentId: string;
  lines: readonly StockLine[];
  actor: StockActor;
};

/** Availability label shown by the catalog (R-INV-11). */
export const availabilityLevel = (
  onHand: number,
  lowStockThreshold: number,
): "available" | "low" | "out" => {
  if (onHand <= 0) return "out";
  return onHand <= lowStockThreshold ? "low" : "available";
};

/** Code-unit order: the same order as `ORDER BY product_id COLLATE "C"` for ASCII ids. */
const byProductId = (a: StockLine, b: StockLine): number => {
  if (a.productId === b.productId) return 0;
  return a.productId < b.productId ? -1 : 1;
};

/** Same product twice is merged; the result is sorted by product id (R-INV-04). */
export const normalizeStockLines = (lines: readonly StockLine[]): StockLine[] => {
  const totals = new Map<string, number>();
  for (const line of lines) {
    totals.set(line.productId, (totals.get(line.productId) ?? 0) + line.quantity);
  }
  return [...totals.entries()]
    .map(([productId, quantity]) => ({ productId, quantity }))
    .sort(byProductId);
};

const findConflicts = (
  lines: readonly StockLine[],
  locked: readonly LockedStock[],
): StockConflict[] => {
  const onHand = new Map(locked.map((row) => [row.productId, row.onHand]));
  return lines
    .map((line) => ({
      productId: line.productId,
      requested: line.quantity,
      available: onHand.get(line.productId) ?? 0,
    }))
    .filter((line) => line.available < line.requested);
};

const stockAudit = (
  movement: StockMovementInput,
  actor: StockActor,
  action: "stock.sale" | "stock.restore",
): AuditEntryInput => ({
  actorId: actor.actorId,
  actorRole: actor.actorRole,
  action,
  entityType: "product",
  entityId: movement.productId,
  before: { onHand: movement.quantityBefore },
  after: { onHand: movement.quantityAfter, orderId: movement.orderId },
});

/**
 * Discounts every line of a paid order, all or nothing (R-INV-03..06, HU-06):
 * 1. locks the inventory rows in deterministic product order (no deadlocks between payments);
 * 2. if any line lacks stock, returns the conflicts WITHOUT touching anything (no partial
 *    discount; the caller records the evidence);
 * 3. otherwise applies the conditional decrements, one `sale` movement and one `stock.sale`
 *    audit row per product.
 */
export const discountForOrder = async (
  { store, audit }: InventoryDeps,
  { orderId, paymentId, lines, actor }: DiscountCommand,
): Promise<DiscountResult> => {
  const sorted = normalizeStockLines(lines);
  const locked = await store.lockStock(sorted.map((line) => line.productId));
  const conflicts = findConflicts(sorted, locked);
  if (conflicts.length > 0) return { ok: false, conflicts };

  const movements: StockMovementInput[] = [];
  for (const line of sorted) {
    const after = await store.decrement(line);
    // Unreachable while the rows are locked; throwing rolls the whole transaction back.
    if (after === null) throw new Error(`Stock changed under lock for product ${line.productId}`);
    movements.push({
      productId: line.productId,
      delta: -line.quantity,
      reason: "sale",
      orderId,
      paymentId,
      actorId: actor.actorId,
      quantityBefore: after + line.quantity,
      quantityAfter: after,
      note: null,
    });
  }
  await store.insertMovements(movements);
  await audit.record(movements.map((movement) => stockAudit(movement, actor, "stock.sale")));
  return { ok: true, movements };
};

export type RestoreCommand = { orderId: string; actor: StockActor; note?: string | null };

export type RestoreResult = { movements: StockMovementInput[]; alreadyRestored: boolean };

const soldLines = (movements: readonly OrderMovement[]): StockLine[] =>
  normalizeStockLines(
    movements
      .filter((movement) => movement.reason === "sale")
      .map((movement) => ({ productId: movement.productId, quantity: -movement.delta })),
  );

/**
 * Restores exactly what the order's `sale` movements discounted (R-INV-07), with one
 * `cancellation_restore` movement and one `stock.restore` audit row per product. Idempotent: an
 * order that was already restored is left untouched.
 */
export const restoreForOrder = async (
  { store, audit }: InventoryDeps,
  { orderId, actor, note = null }: RestoreCommand,
): Promise<RestoreResult> => {
  const existing = await store.listOrderMovements(orderId);
  if (existing.some((movement) => movement.reason === "cancellation_restore")) {
    return { movements: [], alreadyRestored: true };
  }
  const lines = soldLines(existing);
  if (lines.length === 0) return { movements: [], alreadyRestored: false };
  await store.lockStock(lines.map((line) => line.productId));

  const movements: StockMovementInput[] = [];
  for (const line of lines) {
    const after = await store.increment(line);
    if (after === null) throw new Error(`Inventory row missing for product ${line.productId}`);
    movements.push({
      productId: line.productId,
      delta: line.quantity,
      reason: "cancellation_restore",
      orderId,
      paymentId: null,
      actorId: actor.actorId,
      quantityBefore: after - line.quantity,
      quantityAfter: after,
      note,
    });
  }
  await store.insertMovements(movements);
  await audit.record(movements.map((movement) => stockAudit(movement, actor, "stock.restore")));
  return { movements, alreadyRestored: false };
};
