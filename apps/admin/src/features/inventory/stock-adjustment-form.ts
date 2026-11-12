import {
  STOCK_CHANGE_KINDS,
  stockChangeKindSchema,
  stockDeltaIssue,
  stockDeltaSchema,
  stockReasonSchema,
  type StockAdjustmentInput,
  type StockChangeKind,
} from "@repo/shared";
import { z } from "zod";

/** Field values of the receipt / adjustment form (HU-10). */
export type StockAdjustmentValues = { kind: string; delta: string; reason: string };

export const EMPTY_STOCK_ADJUSTMENT: StockAdjustmentValues = {
  kind: "receipt",
  delta: "",
  reason: "",
};

/** Field order, used to focus the first invalid field. */
export const STOCK_ADJUSTMENT_FIELDS = ["kind", "delta", "reason"] as const;

export const STOCK_KIND_OPTIONS: readonly Readonly<{
  value: StockChangeKind;
  label: string;
  hint: string;
}>[] = [
  { value: "receipt", label: "Recepción", hint: "Suma las unidades que llegaron." },
  { value: "adjustment", label: "Ajuste", hint: "Corrige el stock: suma o resta unidades." },
];

const INTEGER_PATTERN = /^[+-]?\d{1,6}$/;

/** Delta typed by the person: "12", "+12" or "-3". */
const deltaFieldSchema = z
  .string()
  .trim()
  .min(1, { error: "Ingresa la cantidad de unidades." })
  .regex(INTEGER_PATTERN, {
    error: "Ingresa una cantidad entera de unidades (por ejemplo, 12 o -3).",
  })
  .transform(Number)
  .pipe(stockDeltaSchema);

/** Same rules as `inventory.adjust` (`@repo/shared`), over the text fields of the form. */
export const stockAdjustmentFormSchema = z
  .object({ kind: stockChangeKindSchema, delta: deltaFieldSchema, reason: stockReasonSchema })
  .superRefine(({ kind, delta }, context) => {
    const message = stockDeltaIssue(kind, delta);
    if (message !== null) context.addIssue({ code: "custom", path: ["delta"], message });
  });

export type StockAdjustmentFormData = z.output<typeof stockAdjustmentFormSchema>;

export function isStockChangeKind(value: string): value is StockChangeKind {
  return (STOCK_CHANGE_KINDS as readonly string[]).includes(value);
}

/** Input of `inventory.adjust` for a validated form. Pure. */
export function toAdjustInput(
  productId: string,
  data: StockAdjustmentFormData,
): StockAdjustmentInput {
  return { productId, ...data };
}

/**
 * Stock after the change being typed, or `null` while the quantity is not a valid integer. Pure.
 * A receipt always adds (a typed sign is ignored by the preview; validation reports it).
 */
export function previewStock(onHand: number, values: StockAdjustmentValues): number | null {
  const text = values.delta.trim();
  if (!INTEGER_PATTERN.test(text)) return null;
  const delta = Number(text);
  return values.kind === "receipt" ? onHand + Math.abs(delta) : onHand + delta;
}

/** Hint under the quantity field, with the resulting stock when it can be computed. Pure. */
export function deltaHint(onHand: number, values: StockAdjustmentValues): string {
  const base =
    values.kind === "receipt"
      ? "Unidades recibidas, por ejemplo 12."
      : "Usa un número negativo para restar, por ejemplo -3.";
  const after = previewStock(onHand, values);
  if (after === null) return base;
  return after < 0
    ? `${base} Quedaría en ${String(after)}: no se permite stock negativo.`
    : `${base} Stock resultante: ${String(after)}.`;
}
