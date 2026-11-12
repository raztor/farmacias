import { seedCatalog, type CatalogSeedClient, type SeedCatalogResult } from "@repo/db";
import type { AppLogger } from "@repo/shared";

/**
 * Synthetic catalog (≥ 200 products) with its inventory rows. Idempotent: missing products are
 * inserted by SKU; existing ones (admin edits, HU-11) and their stock are never modified.
 * `search_text` uses the same normalization as the catalog search (`buildProductSearchText` of
 * @repo/shared, applied inside `seedCatalog`).
 */
export const seedDemoCatalog = async (
  db: CatalogSeedClient,
  logger: AppLogger,
): Promise<SeedCatalogResult> => {
  const result = await seedCatalog(db);
  logger.info(result, "Seed catalog ensured");
  return result;
};
