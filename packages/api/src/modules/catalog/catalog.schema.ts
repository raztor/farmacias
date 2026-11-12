import { PRODUCT_CATEGORIES, type ProductCategory } from "@repo/shared";
import { z } from "zod";

/** Max length of the search term after trimming (R-CAT-09). */
export const CATALOG_SEARCH_MAX_LENGTH = 100;
export const CATALOG_SEARCH_DEFAULT_LIMIT = 20;
export const CATALOG_SEARCH_MAX_LIMIT = 50;
const PRODUCT_ID_MAX_LENGTH = 64;

/**
 * Input of `catalog.search` (docs/specs/catalog.md §5). A blank term (after trimming) lists
 * every active product by name. `cursor` is the `id` of the last item of the previous page.
 */
export const searchCatalogInput = z.object({
  q: z
    .string()
    .trim()
    .max(CATALOG_SEARCH_MAX_LENGTH, {
      error: `La búsqueda admite hasta ${CATALOG_SEARCH_MAX_LENGTH} caracteres`,
    })
    .optional(),
  category: z.enum(PRODUCT_CATEGORIES, { error: "La categoría no existe" }).optional(),
  cursor: z.string().trim().min(1).max(PRODUCT_ID_MAX_LENGTH).optional(),
  limit: z
    .number()
    .int()
    .min(1)
    .max(CATALOG_SEARCH_MAX_LIMIT, {
      error: `Se pueden pedir hasta ${CATALOG_SEARCH_MAX_LIMIT} resultados por página`,
    })
    .default(CATALOG_SEARCH_DEFAULT_LIMIT),
});
/** What callers send (`limit` optional). */
export type CatalogSearchInput = z.input<typeof searchCatalogInput>;
/** What the service receives (`limit` always set). */
export type CatalogSearchQuery = z.output<typeof searchCatalogInput>;

/** Id of a product (`products.id`). */
export const productIdSchema = z
  .string()
  .trim()
  .min(1, { error: "Indica el producto" })
  .max(PRODUCT_ID_MAX_LENGTH, { error: "El identificador del producto no es válido" });

/** Input of `catalog.byId` and `catalog.adminById`. */
export const productByIdInput = z.object({ id: productIdSchema });
export type ProductByIdInput = z.output<typeof productByIdInput>;

/** Availability shown to the public (R-CAT-06): text + icon in the UI, never color only. */
export const PRODUCT_AVAILABILITIES = ["available", "low", "out"] as const;
export type ProductAvailability = (typeof PRODUCT_AVAILABILITIES)[number];

/**
 * Public view of a product (R-CAT-07): no SKU, stock thresholds, internal costs, movements,
 * users or orders.
 */
export type ProductSummary = {
  id: string;
  commercialName: string;
  activeIngredient: string;
  presentation: string;
  category: ProductCategory;
  priceClp: number;
  /** Units on hand (no reservations, D-08). */
  availableQty: number;
  availability: ProductAvailability;
};

export type CatalogSearchResult = {
  items: ProductSummary[];
  /** Pass it back as `cursor` to get the next page; `null` on the last page. */
  nextCursor: string | null;
};
