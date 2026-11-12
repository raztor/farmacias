import { z } from "zod";

/** Mandatory reason of a receipt or adjustment, stored in `stock_movements.note` (D-25). */
export const STOCK_REASON_MIN_LENGTH = 5;
export const STOCK_REASON_MAX_LENGTH = 280;
/** Largest number of units a single receipt or adjustment may move. */
export const STOCK_DELTA_MAX = 10_000;
/** Low-stock threshold range per product (D-26). */
export const LOW_STOCK_THRESHOLD_MAX = 999;

/** Manual stock changes of the back office (HU-10): a receipt adds, an adjustment corrects. */
export const STOCK_CHANGE_KINDS = ["receipt", "adjustment"] as const;
export type StockChangeKind = (typeof STOCK_CHANGE_KINDS)[number];

export const stockChangeKindSchema = z.enum(STOCK_CHANGE_KINDS, {
  error: "Elige si es una recepción o un ajuste.",
});

const REASON_TOO_SHORT = `Indica el motivo (al menos ${String(STOCK_REASON_MIN_LENGTH)} caracteres).`;

/** Reason of a receipt or adjustment: trimmed, 5 to 280 characters (D-25). */
export const stockReasonSchema = z
  .string({ error: REASON_TOO_SHORT })
  .trim()
  .min(STOCK_REASON_MIN_LENGTH, { error: REASON_TOO_SHORT })
  .max(STOCK_REASON_MAX_LENGTH, {
    error: `El motivo admite hasta ${String(STOCK_REASON_MAX_LENGTH)} caracteres.`,
  });

const DELTA_RANGE_MESSAGE = `La cantidad admite hasta ${STOCK_DELTA_MAX.toLocaleString("es-CL")} unidades por movimiento.`;

/** Signed units of a stock change (sign and zero are checked with the kind). */
export const stockDeltaSchema = z
  .number({ error: "Ingresa una cantidad entera de unidades." })
  .int({ error: "Ingresa una cantidad entera de unidades." })
  .min(-STOCK_DELTA_MAX, { error: DELTA_RANGE_MESSAGE })
  .max(STOCK_DELTA_MAX, { error: DELTA_RANGE_MESSAGE });

/**
 * Why a delta is not valid for its kind, or `null`: a receipt adds units (`delta > 0`), an
 * adjustment corrects in either direction (`delta ≠ 0`). Pure.
 */
export function stockDeltaIssue(kind: StockChangeKind, delta: number): string | null {
  if (delta === 0) return "La cantidad no puede ser 0.";
  if (kind === "receipt" && delta < 0) {
    return "Una recepción suma unidades: ingresa una cantidad mayor que 0.";
  }
  return null;
}

/** Input of `inventory.adjust`: a receipt or an adjustment of one product (HU-10, D-25). */
export const stockAdjustmentSchema = z
  .object({
    productId: z
      .string()
      .trim()
      .min(1, { error: "Selecciona un producto." })
      .max(64, { error: "Identificador de producto demasiado largo." }),
    kind: stockChangeKindSchema,
    delta: stockDeltaSchema,
    reason: stockReasonSchema,
  })
  .superRefine(({ kind, delta }, context) => {
    const message = stockDeltaIssue(kind, delta);
    if (message !== null) context.addIssue({ code: "custom", path: ["delta"], message });
  });
export type StockAdjustmentInput = z.output<typeof stockAdjustmentSchema>;

const THRESHOLD_MESSAGE = `El umbral debe ser un número entero entre 0 y ${String(LOW_STOCK_THRESHOLD_MAX)}.`;

/** Low-stock threshold of a product: integer 0..999 (D-26). */
export const lowStockThresholdSchema = z
  .number({ error: THRESHOLD_MESSAGE })
  .int({ error: THRESHOLD_MESSAGE })
  .min(0, { error: THRESHOLD_MESSAGE })
  .max(LOW_STOCK_THRESHOLD_MAX, { error: THRESHOLD_MESSAGE });
