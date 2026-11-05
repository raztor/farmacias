import type { ProductCategory } from "@repo/shared";

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
  category: ProductCategory;
  priceClp: number;
  onHand: number;
  lowStockThreshold: number;
};
