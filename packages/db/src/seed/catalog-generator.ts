import type { ProductCategory } from "@repo/shared";

import type { CatalogSeedProduct, IngredientSpec } from "./catalog-types";

/** Synthetic laboratories used for the generic (unbranded) version of each ingredient. */
const GENERIC_LABS = ["Cordillera", "Quillay", "Macul", "Los Presidentes", "Andino"] as const;

/** Generic versions cost about 55% of the brand. */
const GENERIC_PRICE_FACTOR = 0.55;
const MIN_PRICE_CLP = 990;
const LOW_STOCK_THRESHOLD = 5;

/** Rounds to the usual Chilean shelf price ending in 90 (4.990, 12.490...). */
export function toShelfPrice(priceClp: number): number {
  return Math.max(MIN_PRICE_CLP, Math.round(priceClp / 100) * 100 - 10);
}

/** FNV-1a 32-bit hash: deterministic pseudo-randomness so every seed run is identical. */
export function stableHash(text: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Units on hand derived from the SKU: ~6% out of stock (0), ~10% low (1..5) and the rest
 * between 8 and 150 units.
 */
export function stockForSku(sku: string): number {
  const hash = stableHash(sku);
  const bucket = hash % 100;
  if (bucket < 6) return 0;
  if (bucket < 16) return 1 + (hash % LOW_STOCK_THRESHOLD);
  return 8 + (hash % 143);
}

type Draft = Omit<CatalogSeedProduct, "category" | "onHand" | "lowStockThreshold">;

function ingredientDrafts(spec: IngredientSpec, prefix: string, labIndex: number): Draft[] {
  const lab = GENERIC_LABS[labIndex % GENERIC_LABS.length] ?? GENERIC_LABS[0];
  return spec.variants.flatMap(([presentation, priceClp], index) => [
    {
      sku: `${prefix}-${spec.code}-B${index + 1}`,
      commercialName: spec.brand,
      activeIngredient: spec.activeIngredient,
      presentation,
      priceClp: toShelfPrice(priceClp),
    },
    {
      sku: `${prefix}-${spec.code}-G${index + 1}`,
      commercialName: `${spec.activeIngredient} ${lab}`,
      activeIngredient: spec.activeIngredient,
      presentation,
      priceClp: toShelfPrice(priceClp * GENERIC_PRICE_FACTOR),
    },
  ]);
}

/** Takes items round-robin (first of each list, then second...) so every list is represented. */
function interleave<T>(lists: readonly (readonly T[])[]): T[] {
  const longest = Math.max(0, ...lists.map((list) => list.length));
  const result: T[] = [];
  for (let round = 0; round < longest; round += 1) {
    for (const list of lists) {
      const item = list[round];
      if (item !== undefined) result.push(item);
    }
  }
  return result;
}

export type CategoryCatalog = {
  category: ProductCategory;
  /** SKU prefix, e.g. "CAR". */
  prefix: string;
  /** Exact number of products to generate for the category. */
  target: number;
  ingredients: readonly IngredientSpec[];
};

/**
 * Expands a category into `target` products: brand and generic version of every variant,
 * interleaved by ingredient so the most demanded ingredients (listed first) are always included.
 * Throws when the specs cannot produce `target` products.
 */
export function buildCategoryProducts(catalog: CategoryCatalog): CatalogSeedProduct[] {
  const drafts = interleave(
    catalog.ingredients.map((spec, index) => ingredientDrafts(spec, catalog.prefix, index)),
  );
  if (drafts.length < catalog.target) {
    throw new Error(
      `Category ${catalog.category} yields ${drafts.length} products, ${catalog.target} needed.`,
    );
  }
  return drafts.slice(0, catalog.target).map((draft) => ({
    ...draft,
    category: catalog.category,
    onHand: stockForSku(draft.sku),
    lowStockThreshold: LOW_STOCK_THRESHOLD,
  }));
}
