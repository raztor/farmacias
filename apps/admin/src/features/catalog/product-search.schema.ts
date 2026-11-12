import type { AdminProductStatus } from "@repo/api";
import { z } from "zod";

/** Same limit as the API's `catalog.adminList` input. */
export const PRODUCT_SEARCH_MAX_LENGTH = 100;

/** Search box value: trimmed; blank means "no filter". */
export const productSearchSchema = z
  .string()
  .trim()
  .max(PRODUCT_SEARCH_MAX_LENGTH, { error: `Máximo ${PRODUCT_SEARCH_MAX_LENGTH} caracteres.` })
  .transform((value) => (value === "" ? undefined : value));

/** Status filter options, in display order (same values as `catalog.adminList`). */
export const PRODUCT_STATUS_FILTERS = [
  "all",
  "active",
  "inactive",
] as const satisfies readonly AdminProductStatus[];

export const PRODUCT_STATUS_FILTER_LABELS = {
  all: "Todos",
  active: "Activos",
  inactive: "Inactivos",
} as const satisfies Record<AdminProductStatus, string>;

/** Narrows a `<select>` value to a status filter. */
export function toProductStatusFilter(value: string): AdminProductStatus {
  return PRODUCT_STATUS_FILTERS.find((status) => status === value) ?? "all";
}
