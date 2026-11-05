import { buildProductSearchText } from "@repo/shared";

import type { PrismaClient } from "../generated/prisma/client";
import { buildCatalogProducts } from "./catalog-data";
import type { CatalogSeedProduct } from "./catalog-types";

export type SeedCatalogOptions = {
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

function upsertProduct(db: CatalogSeedClient, product: CatalogSeedProduct) {
  const data = {
    commercialName: product.commercialName,
    activeIngredient: product.activeIngredient,
    presentation: product.presentation,
    category: product.category,
    priceClp: product.priceClp,
    // Same normalization the catalog search applies to the query (@repo/shared), so stored
    // text and query always agree (accents, case, punctuation).
    searchText: buildProductSearchText(product),
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
 * `products.search_text` is built with `buildProductSearchText` from @repo/shared.
 */
export async function seedCatalog(
  db: CatalogSeedClient,
  options: SeedCatalogOptions = {},
): Promise<SeedCatalogResult> {
  const products = options.products ?? buildCatalogProducts();
  const existing = await db.product.findMany({
    where: { sku: { in: products.map((product) => product.sku) } },
    select: { sku: true },
  });
  const existingSkus = new Set(existing.map((product) => product.sku));
  await db.$transaction(products.map((product) => upsertProduct(db, product)));
  const updated = products.filter((product) => existingSkus.has(product.sku)).length;
  return { created: products.length - updated, updated, total: products.length };
}
