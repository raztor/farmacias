import type { CatalogSeedProduct } from "@repo/db";

/** Invented laboratory names for the synthetic variants (RNF-06: no real brands). */
const VARIANT_LABS = [
  "Austral",
  "Pacífico",
  "Volcán",
  "Aconcagua",
  "Atacama",
  "Patagonia",
  "Maipo",
  "Biobío",
  "Elqui",
] as const;

const PRICE_STEP = 0.03;
const MIN_PRICE_CLP = 990;
const STOCK_MODULO = 160;

const shelfPrice = (priceClp: number): number =>
  Math.max(MIN_PRICE_CLP, Math.round(priceClp / 100) * 100 - 10);

const variantLabel = (replica: number): string => {
  const lab = VARIANT_LABS[(replica - 1) % VARIANT_LABS.length] ?? VARIANT_LABS[0];
  const cycle = Math.floor((replica - 1) / VARIANT_LABS.length);
  return cycle === 0 ? lab : `${lab} ${cycle + 1}`;
};

const variantOf = (
  product: CatalogSeedProduct,
  replica: number,
  index: number,
): CatalogSeedProduct => ({
  ...product,
  sku: `${product.sku}-V${replica}`,
  commercialName: `${product.commercialName} ${variantLabel(replica)}`,
  priceClp: shelfPrice(product.priceClp * (1 + PRICE_STEP * replica)),
  // Deterministic spread that includes out-of-stock (0) and low (1..5) units.
  onHand: (index * 7 + replica * 13) % STOCK_MODULO,
});

/**
 * Perf volume for T-10 (RNF-04): the seed catalog plus `replicas - 1` synthetic variants of
 * every product (same active ingredient, presentation and category; an invented laboratory in
 * the commercial name; price +3 % per variant; deterministic stock). `replicas = 10` turns the
 * 200-product seed into 2,000 products. Variants get the SKU suffix `-V<n>`.
 */
export function replicateCatalog(
  products: readonly CatalogSeedProduct[],
  replicas: number,
): CatalogSeedProduct[] {
  if (!Number.isInteger(replicas) || replicas < 1) {
    throw new Error(`replicateCatalog: replicas must be a positive integer, got ${replicas}`);
  }
  const variants = Array.from({ length: replicas - 1 }, (_, offset) =>
    products.map((product, index) => variantOf(product, offset + 1, index)),
  );
  return [...products, ...variants.flat()];
}
