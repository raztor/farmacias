import { buildProductSearchText } from "@repo/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { PrismaClient } from "../generated/prisma/client";
import { TEST_DATABASE_URL } from "../testing/env";
import { createTestDatabase, type TestDatabase } from "../testing/test-database";
import { buildCatalogProducts } from "./catalog-data";
import { seedCatalog } from "./seed-catalog";

describe.skipIf(!TEST_DATABASE_URL)("seedCatalog on PostgreSQL", () => {
  let testDb: TestDatabase | undefined;
  let db: PrismaClient;

  beforeAll(async () => {
    testDb = await createTestDatabase(TEST_DATABASE_URL ?? "");
    db = testDb.db;
  });

  afterAll(async () => {
    await testDb?.drop();
  });

  it("creates every product with its inventory row and normalized search text", async () => {
    const expected = buildCatalogProducts();
    const result = await seedCatalog(db);
    expect(result).toEqual({ created: expected.length, updated: 0, total: expected.length });
    expect(await db.product.count()).toBe(expected.length);
    expect(await db.inventoryItem.count()).toBe(expected.length);

    const sample = expected[0];
    if (!sample) throw new Error("empty catalog");
    const stored = await db.product.findUniqueOrThrow({
      where: { sku: sample.sku },
      include: { inventory: true },
    });
    expect(stored.priceClp).toBe(sample.priceClp);
    expect(stored.searchText).toBe(buildProductSearchText(sample));
    expect(stored.inventory?.onHand).toBe(sample.onHand);
  });

  it("is idempotent and never resets stock", async () => {
    const sample = buildCatalogProducts()[1];
    if (!sample) throw new Error("empty catalog");
    const product = await db.product.findUniqueOrThrow({ where: { sku: sample.sku } });
    await db.inventoryItem.update({
      where: { productId: product.id },
      data: { onHand: sample.onHand + 7 },
    });

    const second = await seedCatalog(db);
    expect(second.created).toBe(0);
    expect(second.updated).toBe(second.total);
    expect(await db.product.count()).toBe(second.total);
    expect(await db.inventoryItem.count()).toBe(second.total);
    const inventory = await db.inventoryItem.findUniqueOrThrow({
      where: { productId: product.id },
    });
    expect(inventory.onHand).toBe(sample.onHand + 7);
  });

  it("stores accent-free search text served by the trigram index", async () => {
    const rows = await db.product.findMany({
      where: { searchText: { contains: "losartan" } },
      select: { activeIngredient: true },
    });
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows.every((row) => row.activeIngredient.startsWith("Losartán"))).toBe(true);
  });
});
