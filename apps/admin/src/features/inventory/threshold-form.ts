import { LOW_STOCK_THRESHOLD_MAX, lowStockThresholdSchema } from "@repo/shared";
import { z } from "zod";

import { stockUnitsLabel } from "./inventory-format";

/** Field values of the low-stock threshold form (HU-12). */
export type ThresholdValues = { threshold: string };

const THRESHOLD_TEXT_MESSAGE = `Ingresa un número entero entre 0 y ${String(LOW_STOCK_THRESHOLD_MAX)}.`;

/** Same rule as `inventory.setThreshold` (`@repo/shared`, D-26), over the text field. */
export const thresholdFormSchema = z.object({
  threshold: z
    .string()
    .trim()
    .regex(/^\d{1,4}$/, { error: THRESHOLD_TEXT_MESSAGE })
    .transform(Number)
    .pipe(lowStockThresholdSchema),
});

/** Initial value of the field: the product's current threshold. Pure. */
export function thresholdValues(lowStockThreshold: number): ThresholdValues {
  return { threshold: String(lowStockThreshold) };
}

/** Toast after saving a threshold. Pure. */
export function thresholdSavedMessage(name: string, threshold: number): string {
  return `Umbral de ${name} actualizado: alerta con ${stockUnitsLabel(threshold)} o menos.`;
}

/** Live count of the alerts page and its link. Pure. */
export function alertsCountText(total: number): string {
  if (total === 0) return "No hay productos con stock bajo.";
  return total === 1 ? "1 producto con stock bajo." : `${String(total)} productos con stock bajo.`;
}
