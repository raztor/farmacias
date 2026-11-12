import { paginationSchema, productFieldsSchema, type ProductCategory } from "@repo/shared";
import { z } from "zod";

import { CATALOG_SEARCH_MAX_LENGTH, productIdSchema } from "./catalog.schema";

/** Status filter of `catalog.adminList`: inactive products stay visible to the admin (R-CAT-15). */
export const ADMIN_PRODUCT_STATUSES = ["all", "active", "inactive"] as const;
export type AdminProductStatus = (typeof ADMIN_PRODUCT_STATUSES)[number];

/**
 * Input of `catalog.adminList` (admin): text filter over name, active ingredient, presentation and
 * SKU, status filter and cursor pagination. A blank term lists every product.
 */
export const adminListProductsInput = paginationSchema.extend({
  q: z
    .string()
    .trim()
    .max(CATALOG_SEARCH_MAX_LENGTH, {
      error: `La búsqueda admite hasta ${CATALOG_SEARCH_MAX_LENGTH} caracteres`,
    })
    .optional(),
  status: z.enum(ADMIN_PRODUCT_STATUSES, { error: "Estado desconocido" }).default("all"),
});
export type AdminListProductsInput = z.input<typeof adminListProductsInput>;
export type AdminListProductsQuery = z.output<typeof adminListProductsInput>;

/** Input of `catalog.create` (R-CAT-12): every editable field of the product. */
export const createProductInput = productFieldsSchema;
export type CreateProductInput = z.output<typeof createProductInput>;

/** Input of `catalog.update` (R-CAT-13): the product id plus the full set of editable fields. */
export const updateProductInput = productFieldsSchema.extend({ id: productIdSchema });
export type UpdateProductInput = z.output<typeof updateProductInput>;

/** Product as the back office sees it (admin only): includes SKU, status and stock. */
export type AdminProduct = {
  id: string;
  sku: string;
  commercialName: string;
  activeIngredient: string;
  presentation: string;
  category: ProductCategory;
  priceClp: number;
  active: boolean;
  /** `inventory_items.on_hand` (0 without an inventory row). */
  onHand: number;
  lowStockThreshold: number;
  updatedAt: Date;
};

export type AdminProductList = {
  items: AdminProduct[];
  /** Pass it back as `cursor` to get the next page; `null` on the last page. */
  nextCursor: string | null;
};
