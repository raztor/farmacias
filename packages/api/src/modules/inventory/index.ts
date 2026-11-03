export { createInventoryStore, type InventoryClient } from "./inventory.repository";
export {
  availabilityLevel,
  discountForOrder,
  normalizeStockLines,
  restoreForOrder,
  type DiscountCommand,
  type DiscountResult,
  type InventoryDeps,
  type InventoryStore,
  type LockedStock,
  type OrderMovement,
  type RestoreCommand,
  type RestoreResult,
  type StockActor,
  type StockConflict,
  type StockLine,
  type StockMovementInput,
} from "./inventory.service";
