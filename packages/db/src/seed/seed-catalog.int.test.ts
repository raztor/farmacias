import assert from "node:assert/strict";
import { test } from "node:test";

import { TEST_DATABASE_URL } from "../testing/env";
import { createTestDatabase } from "../testing/test-database";
import { buildCatalogProducts } from "./catalog-data";
import { seedCatalog, type SearchTextSource } from "./seed-catalog";

const skip = TEST_DATABASE_URL ? false : "TEST_DATABASE_URL no definida";

// The real normalization (accents, punctuation) is tested in @repo/shared; any deterministic
// builder proves the seed stores what it is given.
const buildSearchText = (product: SearchTextSource): string =>
  `${product.commercialName} ${product.activeIngredient} ${product.presentation}`.toLowerCase();

await test("seedCatalog on PostgreSQL", { skip }, async (t) => {
  if (!TEST_DATABASE_URL) return;
  const testDb = await createTestDatabase(TEST_DATABASE_URL);
  const { db } = testDb;
  try {
    await t.test("seedCatalog creates every product with its inventory row", async () => {
      const expected = buildCatalogProducts();
      const result = await seedCatalog(db, { buildSearchText });
      assert.deepEqual(result, { created: expected.length, updated: 0, total: expected.length });
      assert.equal(await db.product.count(), expected.length);
      assert.equal(await db.inventoryItem.count(), expected.length);

      const sample = expected[0];
      assert.ok(sample);
      const stored = await db.product.findUniqueOrThrow({
        where: { sku: sample.sku },
        include: { inventory: true },
      });
      assert.equal(stored.priceClp, sample.priceClp);
      assert.equal(stored.searchText, buildSearchText(sample));
      assert.equal(stored.inventory?.onHand, sample.onHand);
    });

    await t.test("seedCatalog is idempotent and never resets stock", async () => {
      const sample = buildCatalogProducts()[1];
      assert.ok(sample);
      const product = await db.product.findUniqueOrThrow({ where: { sku: sample.sku } });
      await db.inventoryItem.update({
        where: { productId: product.id },
        data: { onHand: sample.onHand + 7 },
      });

      const second = await seedCatalog(db, { buildSearchText });
      assert.equal(second.created, 0);
      assert.equal(second.updated, second.total);
      assert.equal(await db.product.count(), second.total);
      assert.equal(await db.inventoryItem.count(), second.total);
      const inventory = await db.inventoryItem.findUniqueOrThrow({
        where: { productId: product.id },
      });
      assert.equal(inventory.onHand, sample.onHand + 7);
    });

    await t.test("the trigram index serves accent-free ILIKE searches", async () => {
      const rows = await db.product.findMany({
        where: { searchText: { contains: "pregabalina" } },
        select: { activeIngredient: true },
      });
      assert.ok(rows.length >= 4);
      assert.ok(rows.every((row) => row.activeIngredient === "Pregabalina"));
    });
  } finally {
    await testDb.drop();
  }
});
