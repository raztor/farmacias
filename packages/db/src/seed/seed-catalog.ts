import type { PrismaClient } from "../generated/prisma/client";
import { buildCatalogProducts } from "./catalog-data";
import type { CatalogSeedProduct } from "./catalog-types";

/** Fields that feed `products.search_text`. */
export type SearchTextSource = Pick<
  CatalogSeedProduct,
  "commercialName" | "activeIngredient" | "presentation"
>;

export type SeedCatalogOptions = {
  /**
   * Builds `products.search_text`. Pass `buildProductSearchText` from @repo/shared, the same
   * normalization the catalog search applies to the query (injected because @repo/db does not
   * depend on @repo/shared).
   */
  buildSearchText: (product: SearchTextSource) => string;
  /** Products to seed. Defaults to the synthetic demo catalog (`buildCatalogProducts()`). */
  products?: readonly CatalogSeedProduct[];
};

export type SeedCatalogResult = {
  /** Products inserted by this run (with their inventory row). */
  created: number;
  /** Products that already existed and were refreshed (stock untouched). */
  updated: number;
  total: number;
};

/** Minimal client surface used by the seed (a `PrismaClient` satisfies it). */
export type CatalogSeedClient = Pick<PrismaClient, "$transaction" | "product">;

function upsertProduct(db: CatalogSeedClient, product: CatalogSeedProduct, searchText: string) {
  const data = {
    commercialName: product.commercialName,
    activeIngredient: product.activeIngredient,
    presentation: product.presentation,
    category: product.category,
    priceClp: product.priceClp,
    searchText,
  };
  const inventory = { onHand: product.onHand, lowStockThreshold: product.lowStockThreshold };
  return db.product.upsert({
    where: { sku: product.sku },
    create: { sku: product.sku, ...data, inventory: { create: inventory } },
    // Re-running the seed refreshes descriptive data but never resets stock: on-hand units
    // change only through stock movements (sales, restores), so the ledger stays consistent.
    update: { ...data, inventory: { upsert: { create: inventory, update: {} } } },
    select: { id: true },
  });
}

/**
 * Idempotent catalog seed: upserts every product by SKU (plus its inventory row) in a single
 * transaction. Running it again creates nothing new and leaves stock untouched.
 */
export async function seedCatalog(
  db: CatalogSeedClient,
  options: SeedCatalogOptions,
): Promise<SeedCatalogResult> {
  const products = options.products ?? buildCatalogProducts();
  const existing = await db.product.findMany({
    where: { sku: { in: products.map((product) => product.sku) } },
    select: { sku: true },
  });
  const existingSkus = new Set(existing.map((product) => product.sku));
  await db.$transaction(
    products.map((product) => upsertProduct(db, product, options.buildSearchText(product))),
  );
  const updated = products.filter((product) => existingSkus.has(product.sku)).length;
  return { created: products.length - updated, updated, total: products.length };
}
