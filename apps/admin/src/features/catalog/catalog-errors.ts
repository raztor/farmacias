import { PRODUCT_SKU_TAKEN_MESSAGE, PRODUCT_STALE_MESSAGE } from "@repo/shared";

import { getTrpcErrorMessage, isConflictError } from "../../lib/trpc-errors";

/** `catalog.create` / `catalog.update` refused the SKU: shown on the SKU field (R-CAT-13). */
export function isSkuTakenError(error: unknown): boolean {
  return isConflictError(error) && getTrpcErrorMessage(error) === PRODUCT_SKU_TAKEN_MESSAGE;
}

/** Puts a duplicate SKU error on the SKU field; any other error is left to the toast. */
export function reportSkuTaken(
  error: unknown,
  reportFieldError: (field: "sku", message: string) => void,
): void {
  if (isSkuTakenError(error)) reportFieldError("sku", PRODUCT_SKU_TAKEN_MESSAGE);
}

/** Someone saved the product after it was loaded (R-CAT-18): the edit page must reload it. */
export function isStaleProductError(error: unknown): boolean {
  return isConflictError(error) && getTrpcErrorMessage(error) === PRODUCT_STALE_MESSAGE;
}
