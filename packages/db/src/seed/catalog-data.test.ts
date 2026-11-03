import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";

import { CATALOG_CATEGORIES, buildCatalogProducts } from "./catalog-data";
import { SEED_CATEGORIES } from "./catalog-types";

const products = buildCatalogProducts();

const countBy = (category: string): number =>
  products.filter((product) => product.category === category).length;

/** Every SQL file of the versioned migrations, concatenated. */
function readMigrationsSql(): string {
  const directory = new URL("../../prisma/migrations/", import.meta.url);
  return readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => readFileSync(new URL(`${entry.name}/migration.sql`, directory), "utf8"))
    .join("\n");
}

await test("generates at least 200 synthetic products", () => {
  assert.ok(products.length >= 200, `only ${products.length} products`);
});

await test("follows the report's demand split per category (±1 point)", () => {
  const expected = {
    cardiovascular: 0.26,
    "salud-mental": 0.22,
    analgesicos: 0.14,
    suplementos: 0.09,
    digestivo: 0.08,
    otros: 0.21,
  } as const;
  for (const category of SEED_CATEGORIES) {
    const share = countBy(category) / products.length;
    assert.ok(Math.abs(share - expected[category]) <= 0.01, `${category}: ${share}`);
  }
});

await test("matches each category target exactly", () => {
  for (const catalog of CATALOG_CATEGORIES) {
    assert.equal(countBy(catalog.category), catalog.target, catalog.category);
  }
  assert.deepEqual(
    CATALOG_CATEGORIES.map((catalog) => catalog.category),
    [...SEED_CATEGORIES],
  );
});

await test("has unique SKUs and unique product identities", () => {
  assert.equal(new Set(products.map((product) => product.sku)).size, products.length);
  const identities = products.map(
    (product) => `${product.commercialName}|${product.activeIngredient}|${product.presentation}`,
  );
  assert.equal(new Set(identities).size, products.length);
});

await test("has realistic CLP prices: integers between 990 and 60.000 ending in 90", () => {
  for (const product of products) {
    assert.ok(Number.isInteger(product.priceClp), product.sku);
    assert.ok(product.priceClp >= 990 && product.priceClp <= 60_000, product.sku);
    assert.equal(product.priceClp % 100, 90, `${product.sku}: ${product.priceClp}`);
  }
});

await test("has non-empty descriptive fields", () => {
  for (const product of products) {
    for (const field of [product.commercialName, product.activeIngredient, product.presentation]) {
      assert.ok(field.trim().length > 0, product.sku);
    }
  }
});

await test("has some products out of stock, some low (1..5) and most in normal stock", () => {
  const out = products.filter((product) => product.onHand === 0).length;
  const low = products.filter((product) => product.onHand >= 1 && product.onHand <= 5).length;
  const normal = products.length - out - low;
  assert.ok(out >= 5, `out of stock: ${out}`);
  assert.ok(low >= 5, `low stock: ${low}`);
  assert.ok(normal / products.length >= 0.7, `normal stock: ${normal}`);
  for (const product of products) {
    assert.ok(Number.isInteger(product.onHand) && product.onHand >= 0, product.sku);
    assert.equal(product.lowStockThreshold, 5);
  }
});

await test("includes the report's most demanded active ingredients", () => {
  const has = (ingredient: string, presentation: string): boolean =>
    products.some(
      (product) =>
        product.activeIngredient.startsWith(ingredient) &&
        product.presentation.includes(presentation),
    );
  assert.ok(has("Pregabalina", "75 mg"));
  assert.ok(has("Pregabalina", "150 mg"));
  assert.ok(has("Melatonina", "3 mg"));
  assert.ok(has("Multivitamínico", "x 30"));
  assert.ok(has("Celecoxib", "200 mg"));
  assert.ok(has("Losartán", "50 mg"));
  assert.ok(has("Escitalopram", "10 mg"));
  assert.ok(has("Escitalopram", "20 mg"));
});

await test("is deterministic (same catalog on every call)", () => {
  assert.deepEqual(buildCatalogProducts(), products);
});

await test("seed categories match the products_category_check constraint", () => {
  const sql = readMigrationsSql();
  const match = /"products_category_check" CHECK \("category" IN \(([^)]*)\)\)/.exec(sql);
  assert.ok(match?.[1], "products_category_check not found in the migrations");
  const allowed = match[1].split(",").map((value) => value.trim().replaceAll("'", ""));
  assert.deepEqual(allowed, [...SEED_CATEGORIES]);
});
