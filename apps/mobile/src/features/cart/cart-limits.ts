import { ORDER_LINE_MAX_QUANTITY } from "@repo/shared";

/** Units one order line may hold: what is on hand, capped at 99 (same rule as the API). Pure. */
export function maxLineQuantity(availableQty: number): number {
  return Math.max(0, Math.min(availableQty, ORDER_LINE_MAX_QUANTITY));
}

/** Units that can still be added when `inDraft` are already in the order (HU-03 #2). Pure. */
export function maxAddable(availableQty: number, inDraft: number): number {
  return Math.max(0, maxLineQuantity(availableQty) - inDraft);
}

export type AddToOrderState =
  | { kind: "sign_in" }
  | { kind: "out_of_stock" }
  | { kind: "limit_reached"; inDraft: number }
  | { kind: "can_add"; max: number; inDraft: number };

type AddToOrderInput = Readonly<{ isSignedIn: boolean; availableQty: number; inDraft: number }>;

/** What the «add to order» panel of a product shows. Pure. */
export function addToOrderState({
  isSignedIn,
  availableQty,
  inDraft,
}: AddToOrderInput): AddToOrderState {
  if (availableQty <= 0) return { kind: "out_of_stock" };
  if (!isSignedIn) return { kind: "sign_in" };
  const max = maxAddable(availableQty, inDraft);
  if (max === 0) return { kind: "limit_reached", inDraft };
  return { kind: "can_add", max, inDraft };
}

/** The line exceeds what is on hand now (stock dropped after it was added). Pure. */
export function exceedsAvailability(
  line: Readonly<{ quantity: number; availableQty: number }>,
): boolean {
  return line.quantity > maxLineQuantity(line.availableQty);
}

/**
 * Warning for a line that exceeds what is on hand now (RNF-09: what happened and how to
 * continue). With no stock left the quantity cannot go below 1, so only removing the product
 * fixes the line. Pure.
 */
export function availabilityWarning(availableQty: number): string {
  const max = maxLineQuantity(availableQty);
  if (max === 0) return "Este producto se agotó. Quítalo de tu pedido para continuar.";
  if (max === 1) {
    return "Ahora solo queda 1 unidad disponible. Baja la cantidad a 1 o quita el producto.";
  }
  return `Ahora solo hay ${String(max)} unidades disponibles. Baja la cantidad o quita el producto.`;
}
