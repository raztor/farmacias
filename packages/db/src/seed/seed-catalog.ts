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
  /** Products that already existed and were left untouched (data, price, status and stock). */
  existing: number;
  total: number;
};

/** Minimal client surface used by the seed (a `PrismaClient` satisfies it). */
export type CatalogSeedClient = Pick<PrismaClient, "$transaction" | "product">;

function upsertProduct(db: CatalogSeedClient, product: CatalogSeedProduct) {
  const inventory = { onHand: product.onHand, lowStockThreshold: product.lowStockThreshold };
  return db.product.upsert({
    where: { sku: product.sku },
    create: {
      sku: product.sku,
      commercialName: product.commercialName,
      activeIngredient: product.activeIngredient,
      presentation: product.presentation,
      category: product.category,
      priceClp: product.priceClp,
      // Same normalization the catalog search applies to the query (@repo/shared), so stored
      // text and query always agree (accents, case, punctuation).
      searchText: buildProductSearchText(product),
      inventory: { create: inventory },
    },
    // An existing product is never modified: the admin maintains the catalog (HU-11, audited)
    // and re-running the seed must not silently revert those edits. Stock is never reset either
    // (it only changes through movements); the inventory row is created only if it is missing.
    update: { inventory: { upsert: { create: inventory, update: {} } } },
    select: { id: true },
  });
}

/**
 * Idempotent catalog seed: inserts every missing product by SKU (plus its inventory row) in a
 * single transaction. Existing products keep their data, price, status and stock.
 * `products.search_text` is built with `buildProductSearchText` from @repo/shared.
 */
export async function seedCatalog(
  db: CatalogSeedClient,
  options: SeedCatalogOptions = {},
): Promise<SeedCatalogResult> {
  const products = options.products ?? buildCatalogProducts();
  const found = await db.product.findMany({
    where: { sku: { in: products.map((product) => product.sku) } },
    select: { sku: true },
  });
  const existingSkus = new Set(found.map((product) => product.sku));
  await db.$transaction(products.map((product) => upsertProduct(db, product)));
  const existing = products.filter((product) => existingSkus.has(product.sku)).length;
  return { created: products.length - existing, existing, total: products.length };
}
