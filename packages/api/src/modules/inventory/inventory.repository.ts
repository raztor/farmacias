import { Prisma } from "@repo/db";

import type {
  InventoryStore,
  LockedStock,
  OrderMovement,
  StockLine,
  StockMovementInput,
} from "./inventory.service";

/** Prisma client the store needs: always a transaction client in production code. */
export type InventoryClient = Pick<Prisma.TransactionClient, "$queryRaw" | "stockMovement">;

const lockStock = async (tx: InventoryClient, productIds: readonly string[]) => {
  if (productIds.length === 0) return [];
  // COLLATE "C": byte order, identical for every transaction and to the service's JS sort, so
  // concurrent payments always lock shared rows in the same order (no deadlocks).
  return tx.$queryRaw<LockedStock[]>`
    SELECT product_id AS "productId", on_hand AS "onHand"
    FROM inventory_items
    WHERE product_id IN (${Prisma.join([...productIds])})
    ORDER BY product_id COLLATE "C"
    FOR UPDATE`;
};

const decrement = async (tx: InventoryClient, { productId, quantity }: StockLine) => {
  // Atomic conditional update (R-INV-03): never leaves on_hand negative, even without the lock.
  const rows = await tx.$queryRaw<{ onHand: number }[]>`
    UPDATE inventory_items
    SET on_hand = on_hand - ${quantity}, version = version + 1, updated_at = now()
    WHERE product_id = ${productId} AND on_hand >= ${quantity}
    RETURNING on_hand AS "onHand"`;
  return rows[0]?.onHand ?? null;
};

const increment = async (tx: InventoryClient, { productId, quantity }: StockLine) => {
  const rows = await tx.$queryRaw<{ onHand: number }[]>`
    UPDATE inventory_items
    SET on_hand = on_hand + ${quantity}, version = version + 1, updated_at = now()
    WHERE product_id = ${productId}
    RETURNING on_hand AS "onHand"`;
  return rows[0]?.onHand ?? null;
};

const insertMovements = async (
  tx: InventoryClient,
  movements: readonly StockMovementInput[],
): Promise<void> => {
  if (movements.length === 0) return;
  await tx.stockMovement.createMany({ data: [...movements] });
};

const listOrderMovements = (tx: InventoryClient, orderId: string): Promise<OrderMovement[]> =>
  tx.stockMovement.findMany({
    where: { orderId },
    select: { productId: true, delta: true, reason: true },
    orderBy: { createdAt: "asc" },
  });

/** Inventory store bound to a transaction client (`tx` of `$transaction`). */
export const createInventoryStore = (tx: InventoryClient): InventoryStore => ({
  lockStock: (productIds) => lockStock(tx, productIds),
  decrement: (line) => decrement(tx, line),
  increment: (line) => increment(tx, line),
  insertMovements: (movements) => insertMovements(tx, movements),
  listOrderMovements: (orderId) => listOrderMovements(tx, orderId),
});
