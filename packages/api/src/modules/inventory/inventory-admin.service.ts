import { AppError, noopLogger, normalizeSearchText, type AppLogger } from "@repo/shared";

import type { ApiDependencies } from "../../trpc";
import type { AuditEntryInput } from "../audit";
import {
  createInventoryAdminRunner,
  createInventoryReader,
  type InventoryAdminRunner,
  type InventoryAdminTx,
  type InventoryReader,
  type InventoryRecord,
} from "./inventory-admin.repository";
import type {
  AdjustStockInput,
  AlertsResult,
  InventoryItemView,
  ListInventoryInput,
  ListInventoryResult,
  MovementsInput,
  MovementsResult,
  SetThresholdInput,
  StockAdjustmentResult,
} from "./inventory.schema";
import { ALERTS_MAX_ITEMS } from "./inventory.schema";
import {
  availabilityLevel,
  type InventoryDeps,
  type StockActor,
  type StockMovementInput,
} from "./inventory.service";

/**
 * Back-office stock (HU-10, HU-12; docs/specs/inventory.md R-INV-12..R-INV-20): list, ledger,
 * receipts and adjustments with a mandatory reason, per-product low-stock thresholds and alerts.
 * Every write runs in one interactive transaction with its movement and audit rows (D-22, D-25).
 */

export const PRODUCT_NOT_FOUND_MESSAGE = "El producto no existe o no tiene inventario.";
export const NEGATIVE_STOCK_MESSAGE = "El ajuste dejaría el stock en negativo.";

export type InventoryAdminDeps = {
  reader: InventoryReader;
  runner: InventoryAdminRunner;
  logger?: AppLogger;
};

export type InventoryAdminService = {
  list: (input: ListInventoryInput) => Promise<ListInventoryResult>;
  product: (productId: string) => Promise<InventoryItemView>;
  movements: (input: MovementsInput) => Promise<MovementsResult>;
  adjust: (actor: StockActor, input: AdjustStockInput) => Promise<StockAdjustmentResult>;
  alerts: () => Promise<AlertsResult>;
  setThreshold: (actor: StockActor, input: SetThresholdInput) => Promise<InventoryItemView>;
};

export const toItemView = (record: InventoryRecord): InventoryItemView => ({
  ...record,
  level: availabilityLevel(record.onHand, record.lowStockThreshold),
});

const notFound = (): AppError =>
  new AppError("NOT_FOUND", PRODUCT_NOT_FOUND_MESSAGE, { details: { reason: "NOT_FOUND" } });

const negativeStock = (onHand: number): AppError =>
  new AppError("BAD_REQUEST", NEGATIVE_STOCK_MESSAGE, {
    details: { reason: "NEGATIVE_STOCK", onHand },
  });

/** Keyset page: one extra row tells whether there is a next page. */
const toPage = <T>(rows: readonly T[], limit: number, idOf: (row: T) => string) => {
  const items = rows.slice(0, limit);
  const last = items.at(-1);
  return { items, nextCursor: rows.length > limit && last ? idOf(last) : null };
};

const adjustmentAudit = (actor: StockActor, movement: StockMovementInput): AuditEntryInput => ({
  actorId: actor.actorId,
  actorRole: actor.actorRole,
  action: movement.reason === "receipt" ? "stock.receipt" : "stock.adjustment",
  entityType: "product",
  entityId: movement.productId,
  before: { onHand: movement.quantityBefore },
  after: { onHand: movement.quantityAfter },
});

/**
 * Receipt or adjustment inside the caller's transaction (R-INV-13..R-INV-15): locks the row (same
 * lock as the payment discount, so a concurrent sale waits), rejects a change that would leave
 * negative stock BEFORE writing anything, then writes the movement and its audit row.
 */
export const applyStockAdjustment = async (
  { store, audit }: InventoryDeps,
  actor: StockActor,
  { productId, kind, delta, reason }: AdjustStockInput,
): Promise<StockMovementInput> => {
  const [locked] = await store.lockStock([productId]);
  if (!locked) throw notFound();
  if (locked.onHand + delta < 0) throw negativeStock(locked.onHand);
  const after =
    delta > 0
      ? await store.increment({ productId, quantity: delta })
      : await store.decrement({ productId, quantity: -delta });
  // Unreachable while the row is locked; throwing rolls the transaction back.
  if (after === null) throw negativeStock(locked.onHand);
  const movement: StockMovementInput = {
    productId,
    delta,
    reason: kind,
    orderId: null,
    paymentId: null,
    actorId: actor.actorId,
    quantityBefore: locked.onHand,
    quantityAfter: after,
    note: reason,
  };
  await store.insertMovements([movement]);
  await audit.record([adjustmentAudit(actor, movement)]);
  return movement;
};

/** Threshold change inside the caller's transaction (R-INV-17); a no-op writes nothing. */
export const applyThresholdChange = async (
  { thresholds, audit }: InventoryAdminTx,
  actor: StockActor,
  { productId, threshold }: SetThresholdInput,
): Promise<boolean> => {
  const current = await thresholds.lockThreshold(productId);
  if (!current) throw notFound();
  if (current.lowStockThreshold === threshold) return false;
  await thresholds.updateThreshold(productId, threshold);
  await audit.record([
    {
      actorId: actor.actorId,
      actorRole: actor.actorRole,
      action: "inventory.threshold_change",
      entityType: "product",
      entityId: productId,
      before: { lowStockThreshold: current.lowStockThreshold },
      after: { lowStockThreshold: threshold },
    },
  ]);
  return true;
};

const listInventory = async (
  reader: InventoryReader,
  { cursor, limit, search, onlyLow = false }: ListInventoryInput,
): Promise<ListInventoryResult> => {
  const term = search ? normalizeSearchText(search) : "";
  const rows = await reader.list({
    take: limit + 1,
    cursor,
    term: term === "" ? undefined : term,
    sku: search === "" ? undefined : search,
    onlyLow,
  });
  const page = toPage(rows, limit, (row) => row.productId);
  return { items: page.items.map(toItemView), nextCursor: page.nextCursor };
};

export const createInventoryAdminService = ({
  reader,
  runner,
  logger = noopLogger,
}: InventoryAdminDeps): InventoryAdminService => {
  const product = async (productId: string) => {
    const record = await reader.findItem(productId);
    if (!record) throw notFound();
    return toItemView(record);
  };

  return {
    list: (input) => listInventory(reader, input),

    product,

    movements: async ({ productId, cursor, limit }) => {
      const rows = await reader.movements({ productId, take: limit + 1, cursor });
      return toPage(rows, limit, (row) => row.id);
    },

    adjust: async (actor, input) => {
      const movement = await runner.transaction((tx) => applyStockAdjustment(tx, actor, input));
      const { productId, kind, delta } = input;
      logger.info({ productId, kind, delta, actorId: actor.actorId }, "Stock adjusted");
      const { quantityBefore, quantityAfter } = movement;
      return { item: await product(productId), kind, delta, quantityBefore, quantityAfter };
    },

    alerts: async () => {
      const { items, total } = await reader.alerts(ALERTS_MAX_ITEMS);
      return { items: items.map(toItemView), total };
    },

    setThreshold: async (actor, input) => {
      const changed = await runner.transaction((tx) => applyThresholdChange(tx, actor, input));
      if (changed) {
        logger.info(
          { productId: input.productId, threshold: input.threshold, actorId: actor.actorId },
          "Low-stock threshold changed",
        );
      }
      return product(input.productId);
    },
  };
};

/** Wires the service to its Prisma repositories and the request logger. */
export const createInventoryAdminServiceFromDeps = (
  deps: Pick<ApiDependencies, "db">,
  logger: AppLogger,
): InventoryAdminService =>
  createInventoryAdminService({
    reader: createInventoryReader(deps.db),
    runner: createInventoryAdminRunner(deps.db),
    logger,
  });
