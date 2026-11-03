import { AppError } from "@repo/shared";

/**
 * Errors of the orders module. Messages are plain Spanish (Chile) that say what happened and how
 * to continue (RNF-09); `details.reason` lets clients react without parsing text.
 */

/** Another account's order, or a missing one: the same answer, so ids cannot be probed (D-10). */
export const orderNotFoundError = (): AppError =>
  new AppError("NOT_FOUND", "No encontramos ese pedido.");

export const draftNotFoundError = (): AppError =>
  new AppError(
    "NOT_FOUND",
    "No tienes un pedido en preparación. Agrega un producto del catálogo para comenzar.",
  );

export const productNotFoundError = (): AppError =>
  new AppError("NOT_FOUND", "Este producto no está disponible en el catálogo.");

export const lineNotFoundError = (): AppError =>
  new AppError("NOT_FOUND", "Ese producto no está en tu pedido.");

const exceedsMessage = (commercialName: string, maxAllowed: number, inDraft: number): string => {
  if (maxAllowed > 0) {
    const units = maxAllowed === 1 ? "1 unidad" : `${String(maxAllowed)} unidades`;
    return `Solo puedes agregar hasta ${units} de ${commercialName}.`;
  }
  if (inDraft > 0) {
    return `Ya tienes en tu pedido todas las unidades disponibles de ${commercialName}.`;
  }
  return `${commercialName} no tiene unidades disponibles por ahora.`;
};

/** HU-03 #2: the quantity exceeds availability; the message states the maximum allowed. */
export const quantityExceedsError = (input: {
  productId: string;
  commercialName: string;
  maxAllowed: number;
  inDraft: number;
}): AppError =>
  new AppError("CONFLICT", exceedsMessage(input.commercialName, input.maxAllowed, input.inDraft), {
    details: {
      reason: "QUANTITY_EXCEEDS_AVAILABLE",
      productId: input.productId,
      maxAllowed: input.maxAllowed,
    },
  });

export const emptyOrderError = (): AppError =>
  new AppError("CONFLICT", "Tu pedido no tiene productos. Agrega al menos uno para confirmarlo.", {
    details: { reason: "EMPTY_ORDER" },
  });

export const incompleteFulfillmentError = (): AppError =>
  new AppError(
    "BAD_REQUEST",
    "Elige retiro en farmacia o despacho simulado antes de confirmar tu pedido.",
    { details: { reason: "INCOMPLETE_FULFILLMENT", fields: ["fulfillment"] } },
  );

export type UnavailableLine = { productId: string; commercialName: string };

export const productsUnavailableError = (products: readonly UnavailableLine[]): AppError =>
  new AppError(
    "CONFLICT",
    `Ya no está disponible: ${products.map((product) => product.commercialName).join(", ")}. ` +
      "Quítalo de tu pedido para continuar.",
    { details: { reason: "PRODUCT_UNAVAILABLE", products } },
  );

export type ShortLine = UnavailableLine & { requested: number; available: number };

export const insufficientStockError = (lines: readonly ShortLine[]): AppError =>
  new AppError(
    "CONFLICT",
    `No hay unidades suficientes de: ${lines.map((line) => line.commercialName).join(", ")}. ` +
      "Ajusta las cantidades para confirmar tu pedido.",
    { details: { reason: "INSUFFICIENT_STOCK", lines } },
  );
