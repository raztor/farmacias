import { seedCatalog, type CatalogSeedClient, type SeedCatalogResult } from "@repo/db";
import { buildProductSearchText, type AppLogger } from "@repo/shared";

/**
 * Synthetic catalog (≥ 200 products) with its inventory rows. Idempotent: products are upserted
 * by SKU and the stock of existing products is never reset (it only changes through movements).
 * `search_text` uses the same normalization as the catalog search (`buildProductSearchText`).
 */
export const seedDemoCatalog = async (
  db: CatalogSeedClient,
  logger: AppLogger,
): Promise<SeedCatalogResult> => {
  const result = await seedCatalog(db, { buildSearchText: buildProductSearchText });
  logger.info(result, "Seed catalog ensured");
  return result;
};
