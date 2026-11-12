import { ORDER_LINE_MAX_QUANTITY } from "@repo/shared";

/**
 * Pure planning of "Repetir pedido" (HU-14, D-30, R-ORD-16): which units of a previous order can
 * be added to the current draft, and why the others were not. No I/O, so every rule is unit-tested.
 */

/** `reduced`: fewer units than requested; `unavailable`: no stock; `inactive`: off the catalog. */
export type RepeatChangeReason = "reduced" | "unavailable" | "inactive";

/** A product of the previous order and the units it had. */
export type RepeatSourceLine = { productId: string; quantity: number };

/** The product as it is in the catalog right now (drafts reserve nothing, D-08). */
export type RepeatAvailability = {
  productId: string;
  commercialName: string;
  active: boolean;
  onHand: number;
};

/** What the draft already holds of a product. */
export type RepeatDraftLine = { productId: string; quantity: number };

/** One product that was not added in full (`added < requested`). */
export type RepeatChange = {
  productId: string;
  commercialName: string;
  requested: number;
  added: number;
  reason: RepeatChangeReason;
};

/** A line to write: `quantity` is the new line total (draft units + `added`). */
export type RepeatAddition = { productId: string; added: number; quantity: number };

export type RepeatPlan = { additions: RepeatAddition[]; changes: RepeatChange[] };

type LineOutcome = { addition: RepeatAddition | null; change: RepeatChange | null };

const planLine = (
  line: RepeatSourceLine,
  product: RepeatAvailability | undefined,
  inDraft: number,
): LineOutcome => {
  const base = { productId: line.productId, requested: line.quantity };
  if (!product?.active) {
    const commercialName = product?.commercialName ?? "Producto";
    return { addition: null, change: { ...base, commercialName, added: 0, reason: "inactive" } };
  }
  const { commercialName } = product;
  if (product.onHand <= 0) {
    return { addition: null, change: { ...base, commercialName, added: 0, reason: "unavailable" } };
  }
  const lineMax = Math.min(product.onHand, ORDER_LINE_MAX_QUANTITY);
  const added = Math.max(0, Math.min(line.quantity, lineMax - inDraft));
  const addition =
    added > 0 ? { productId: line.productId, added, quantity: inDraft + added } : null;
  const change =
    added < line.quantity ? { ...base, commercialName, added, reason: "reduced" as const } : null;
  return { addition, change };
};

/**
 * Adds each previous line on top of what the draft has, capped by the units on hand and by the
 * 99-units-per-line maximum (R-ORD-03). Inactive products are skipped as `inactive`, products
 * without stock as `unavailable`, and partially added ones are reported as `reduced` (also with
 * `added: 0` when the draft already holds every unit allowed). Lines added in full produce no change.
 */
export const planRepeat = (
  previousLines: readonly RepeatSourceLine[],
  availability: readonly RepeatAvailability[],
  draftLines: readonly RepeatDraftLine[],
): RepeatPlan => {
  const products = new Map(availability.map((product) => [product.productId, product]));
  const inDraft = new Map(draftLines.map((line) => [line.productId, line.quantity]));
  const plan: RepeatPlan = { additions: [], changes: [] };
  for (const line of previousLines) {
    const outcome = planLine(line, products.get(line.productId), inDraft.get(line.productId) ?? 0);
    if (outcome.addition) plan.additions.push(outcome.addition);
    if (outcome.change) plan.changes.push(outcome.change);
  }
  return plan;
};
