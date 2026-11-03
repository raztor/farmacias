/**
 * Product categories accepted by the CHECK `products_category_check`.
 *
 * Mirrors `PRODUCT_CATEGORIES` of @repo/shared. @repo/db does not depend on @repo/shared yet,
 * so the list is repeated here; `catalog-data.test.ts` checks it against the migration SQL.
 */
export const SEED_CATEGORIES = [
  "cardiovascular",
  "salud-mental",
  "analgesicos",
  "suplementos",
  "digestivo",
  "otros",
] as const;

export type SeedCategory = (typeof SEED_CATEGORIES)[number];

/** `[presentation, brand price in CLP]` of one sellable variant. */
export type VariantSpec = readonly [presentation: string, priceClp: number];

/** One active ingredient with its synthetic brand and its sellable variants. */
export type IngredientSpec = {
  /** Short stable code used in the SKU (e.g. "LOS"). Unique within its category. */
  code: string;
  activeIngredient: string;
  /** Synthetic (invented) brand name. */
  brand: string;
  variants: readonly VariantSpec[];
};

/** Synthetic product ready to be upserted by `seedCatalog`. */
export type CatalogSeedProduct = {
  sku: string;
  commercialName: string;
  activeIngredient: string;
  presentation: string;
  category: SeedCategory;
  priceClp: number;
  onHand: number;
  lowStockThreshold: number;
};
