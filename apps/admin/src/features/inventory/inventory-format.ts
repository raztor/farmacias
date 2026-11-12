import type { StockAdjustmentResult, StockLevel } from "@repo/api";
import type { StockChangeKind, StockMovementReason } from "@repo/shared";

/** Spanish label of a stock level (D-17: always text plus symbol, never color only). */
export const STOCK_LEVEL_LABELS: Readonly<Record<StockLevel, string>> = {
  available: "Disponible",
  low: "Stock bajo",
  out: "Agotado",
};

/** Badge tone of a stock level (the label and symbol carry the meaning). */
export const STOCK_LEVEL_TONES = {
  available: "success",
  low: "warning",
  out: "danger",
} as const satisfies Record<StockLevel, string>;

/** Spanish label of a stock movement reason (R-INV-09). */
export const MOVEMENT_REASON_LABELS: Readonly<Record<StockMovementReason, string>> = {
  sale: "Venta (pago aprobado)",
  cancellation_restore: "Restauración por cancelación",
  receipt: "Recepción",
  adjustment: "Ajuste",
};

const CHANGE_KIND_DONE: Readonly<Record<StockChangeKind, string>> = {
  receipt: "Recepción registrada",
  adjustment: "Ajuste registrado",
};

/** "1 unidad", "0 unidades", "12 unidades". */
export function stockUnitsLabel(count: number): string {
  return count === 1 ? "1 unidad" : `${String(count)} unidades`;
}

/** Signed change for the ledger: "+12", "-3". */
export function formatDelta(delta: number): string {
  return delta > 0 ? `+${String(delta)}` : String(delta);
}

/** Toast after a receipt or adjustment, with the resulting stock. Pure. */
export function adjustmentSuccessMessage(
  result: Pick<StockAdjustmentResult, "kind" | "delta" | "quantityAfter"> & {
    item: Pick<StockAdjustmentResult["item"], "name">;
  },
): string {
  const units = `${formatDelta(result.delta)} ${result.delta === 1 || result.delta === -1 ? "unidad" : "unidades"}`;
  return `${CHANGE_KIND_DONE[result.kind]} para ${result.item.name} (${units}). Stock actual: ${stockUnitsLabel(result.quantityAfter)}.`;
}
