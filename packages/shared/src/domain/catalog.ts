import { createOneOfGuard } from "./one-of";

/**
 * Therapeutic categories of the catalog (Inception v2.0, demand by category).
 * Stored as TEXT in `products.category`, guarded by the CHECK `products_category_check`:
 * keep both lists in sync (packages/db/prisma/migrations).
 */
export const PRODUCT_CATEGORIES = [
  "cardiovascular",
  "salud-mental",
  "analgesicos",
  "suplementos",
  "digestivo",
  "otros",
] as const;

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

/** Spanish (Chile) labels for the UI. */
export const PRODUCT_CATEGORY_LABELS = {
  cardiovascular: "Cardiovascular",
  "salud-mental": "Salud mental",
  analgesicos: "Analgésicos",
  suplementos: "Suplementos",
  digestivo: "Digestivo",
  otros: "Otros",
} as const satisfies Record<ProductCategory, string>;

export const isProductCategory = createOneOfGuard(PRODUCT_CATEGORIES);
