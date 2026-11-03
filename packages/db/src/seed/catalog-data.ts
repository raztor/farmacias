import { ANALGESICOS_CATALOG } from "./catalog-analgesicos";
import { CARDIOVASCULAR_CATALOG } from "./catalog-cardiovascular";
import { DIGESTIVO_CATALOG } from "./catalog-digestivo";
import { buildCategoryProducts, type CategoryCatalog } from "./catalog-generator";
import { OTROS_CATALOG } from "./catalog-otros";
import { SALUD_MENTAL_CATALOG } from "./catalog-salud-mental";
import { SUPLEMENTOS_CATALOG } from "./catalog-suplementos";
import type { CatalogSeedProduct } from "./catalog-types";

/**
 * Category catalogs with their target sizes, following the demand split of the Inception
 * report: cardiovascular 26%, salud mental 22%, analgésicos 14%, suplementos 9%,
 * digestivo 8%, otros 21% (200 products).
 */
export const CATALOG_CATEGORIES: readonly CategoryCatalog[] = [
  CARDIOVASCULAR_CATALOG,
  SALUD_MENTAL_CATALOG,
  ANALGESICOS_CATALOG,
  SUPLEMENTOS_CATALOG,
  DIGESTIVO_CATALOG,
  OTROS_CATALOG,
];

/** Every synthetic product of the demo catalog (deterministic: same output on every call). */
export function buildCatalogProducts(): CatalogSeedProduct[] {
  return CATALOG_CATEGORIES.flatMap((catalog) => buildCategoryProducts(catalog));
}
