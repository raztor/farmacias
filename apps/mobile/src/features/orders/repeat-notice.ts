import type { RepeatChange } from "@repo/api";
import type { Tone } from "@repo/ui";

/**
 * "Repetir pedido" (HU-14, D-30): what the cart shows after repeating an order. The mutation
 * stores it in the query cache under `REPEAT_NOTICE_KEY` (cleared with the rest of the cache when
 * the signed-in user changes) and the cart reads it. Pure: no React, no I/O.
 */
export type RepeatNotice = Readonly<{
  orderCode: string;
  /** Lines of the repeated order, to tell "nothing was added" from "some products changed". */
  lineCount: number;
  changes: readonly RepeatChange[];
}>;

export const REPEAT_NOTICE_KEY = ["cart", "repeat-notice"] as const;

const addedUnits = (added: number, requested: number): string =>
  added === 1
    ? `se agregó 1 de ${String(requested)}`
    : `se agregaron ${String(added)} de ${String(requested)}`;

/** One change in plain Spanish, e.g. «Ibuprofeno: agotado, no se agregó». Pure. */
export function formatRepeatChange(change: RepeatChange): string {
  const name = change.commercialName;
  switch (change.reason) {
    case "inactive":
      return `${name}: ya no está en el catálogo, no se agregó`;
    case "unavailable":
      return `${name}: agotado, no se agregó`;
    case "reduced":
      return change.added === 0
        ? `${name}: ya tienes en tu pedido todas las unidades disponibles, no se agregó`
        : `${name}: ${addedUnits(change.added, change.requested)} por disponibilidad`;
  }
}

export type RepeatNoticeView = Readonly<{ tone: Tone; title: string; items: string[] }>;

/** Tone, title and one line per change of the cart notice. Pure. */
export function repeatNoticeView({
  orderCode,
  lineCount,
  changes,
}: RepeatNotice): RepeatNoticeView {
  const items = changes.map(formatRepeatChange);
  if (changes.length === 0) {
    return { tone: "success", title: `Agregamos los productos del pedido ${orderCode}`, items };
  }
  const nothingAdded = changes.length >= lineCount && changes.every((change) => change.added === 0);
  return nothingAdded
    ? { tone: "warning", title: `No pudimos agregar productos del pedido ${orderCode}`, items }
    : { tone: "warning", title: `Agregamos el pedido ${orderCode} con cambios`, items };
}
