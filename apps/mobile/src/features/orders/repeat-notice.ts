import type { RepeatChange } from "@repo/api";
import type { Tone } from "@repo/ui";

/**
 * "Repetir pedido" (HU-14, D-30): what the cart shows after repeating an order. The mutation
 * stores it in the query cache under `REPEAT_NOTICE_KEY` (cleared with the rest of the cache when
 * the signed-in user changes) and the cart reads it. Pure: no React, no I/O.
 */
export type RepeatNotice = Readonly<{
  orderCode: string;
  /** Draft the changes were applied to (`null`: nothing added and there was no draft). */
  draftId: string | null;
  /** Lines of the repeated order, to tell "nothing was added" from "some products changed". */
  lineCount: number;
  changes: readonly RepeatChange[];
}>;

export const REPEAT_NOTICE_KEY = ["cart", "repeat-notice"] as const;

/**
 * The notice belongs to one cart: once that draft is confirmed or replaced (another draft id, or
 * a draft created after nothing could be added) it no longer applies and is hidden. Pure.
 */
export function noticeForDraft(
  notice: RepeatNotice | null,
  draftId: string | null,
): RepeatNotice | null {
  return notice?.draftId === draftId ? notice : null;
}

const LINE_CAP = 99;

const addedUnits = (added: number, requested: number): string =>
  added === 1
    ? `se agregó 1 de ${String(requested)}`
    : `se agregaron ${String(added)} de ${String(requested)}`;

const productName = ({ commercialName, presentation }: RepeatChange): string =>
  presentation.length > 0 ? `${commercialName} (${presentation})` : commercialName;

const reducedText = (change: RepeatChange): string => {
  if (change.added > 0) {
    const cause = change.lineCapReached
      ? `(máximo ${String(LINE_CAP)} por producto)`
      : "por disponibilidad";
    return `${addedUnits(change.added, change.requested)} ${cause}`;
  }
  return change.lineCapReached
    ? `ya tienes en tu pedido ${String(LINE_CAP)} unidades, el máximo por producto; no se agregó`
    : "ya tienes en tu pedido todas las unidades disponibles, no se agregó";
};

/**
 * One change in plain Spanish, with the presentation to tell apart products that share a name,
 * e.g. «Ibuprofeno (Comprimidos 400 mg x 20): agotado, no se agregó». Pure.
 */
export function formatRepeatChange(change: RepeatChange): string {
  const name = productName(change);
  switch (change.reason) {
    case "inactive":
      return `${name}: ya no está en el catálogo, no se agregó`;
    case "unavailable":
      return `${name}: agotado, no se agregó`;
    case "reduced":
      return `${name}: ${reducedText(change)}`;
  }
}

/** One line of the notice; `productId` is its stable key (names can repeat). */
export type RepeatNoticeItem = Readonly<{ productId: string; text: string }>;

export type RepeatNoticeView = Readonly<{ tone: Tone; title: string; items: RepeatNoticeItem[] }>;

/** Tone, title and one line per change of the cart notice. Pure. */
export function repeatNoticeView({
  orderCode,
  lineCount,
  changes,
}: Omit<RepeatNotice, "draftId">): RepeatNoticeView {
  const items = changes.map((change) => ({
    productId: change.productId,
    text: formatRepeatChange(change),
  }));
  if (changes.length === 0) {
    return { tone: "success", title: `Agregamos los productos del pedido ${orderCode}`, items };
  }
  const nothingAdded = changes.length >= lineCount && changes.every((change) => change.added === 0);
  return nothingAdded
    ? { tone: "warning", title: `No pudimos agregar productos del pedido ${orderCode}`, items }
    : { tone: "warning", title: `Agregamos el pedido ${orderCode} con cambios`, items };
}
