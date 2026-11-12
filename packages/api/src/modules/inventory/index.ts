export { createInventoryStore, type InventoryClient } from "./inventory.repository";
export { inventoryRouter } from "./inventory.router";
export {
  type AlertsResult,
  type InventoryItemView,
  type ListInventoryInput,
  type ListInventoryResult,
  type MovementsInput,
  type MovementsResult,
  type SetThresholdInput,
  type StockAdjustmentResult,
  type StockLevel,
  type StockMovementView,
} from "./inventory.schema";
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
