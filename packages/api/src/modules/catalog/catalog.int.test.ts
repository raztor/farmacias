import { buildCatalogProducts, seedCatalog, type PrismaClient } from "@repo/db";
import { buildProductSearchText, normalizeSearchText } from "@repo/shared";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createCaller } from "../../root";
import { createTestDeps } from "../../testing/fakes";
import {
  createProduct,
  disconnectTestDb,
  getTestDb,
  INTEGRATION_ENABLED,
  resetDatabase,
  setStock,
} from "../../testing/integration";
import { createTRPCContext } from "../../trpc";

const PUBLIC_FIELDS = [
  "activeIngredient",
  "availability",
  "availableQty",
  "category",
  "commercialName",
  "id",
  "presentation",
  "priceClp",
].sort();

/** Anonymous caller (no session) over the real database: HU-01 #3. */
const anonymousCaller = async (db: PrismaClient) =>
  createCaller(
    await createTRPCContext({
      deps: { ...createTestDeps({ session: null }), db },
      headers: new Headers(),
      requestId: "catalog-int",
    }),
  );

type Caller = Awaited<ReturnType<typeof anonymousCaller>>;

/** Walks every page of a search and returns the item ids in order. */
const collectAllPages = async (caller: Caller, q: string, limit: number) => {
  const ids: string[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < 50; page += 1) {
    const result = await caller.catalog.search({ q, limit, cursor });
    ids.push(...result.items.map((item) => item.id));
    if (result.nextCursor === null) return ids;
    cursor = result.nextCursor;
  }
  throw new Error("pagination did not finish");
};

describe.skipIf(!INTEGRATION_ENABLED)("catalog (PostgreSQL)", () => {
  const db = INTEGRATION_ENABLED ? getTestDb() : undefined;
  const testDb = () => {
    if (!db) throw new Error("integration disabled");
    return db;
  };

  afterAll(async () => {
    await disconnectTestDb();
  });

  describe("on the real synthetic seed (CAT-I01, HU-01 #1, #2, #3)", () => {
    const seedProducts = buildCatalogProducts();
    const expectedFor = (term: string) =>
      seedProducts.filter((product) =>
        buildProductSearchText(product).includes(normalizeSearchText(term)),
      );
    let caller: Caller;

    beforeAll(async () => {
      await resetDatabase(testDb());
      await seedCatalog(testDb(), { buildSearchText: buildProductSearchText });
      caller = await anonymousCaller(testDb());
    });

    it("finds 'Losartán' when searching 'losartan' (accent and case insensitive)", async () => {
      const expected = expectedFor("losartan");
      expect(expected.length).toBeGreaterThan(0);

      const plain = await caller.catalog.search({ q: "losartan", limit: 50 });
      const accented = await caller.catalog.search({ q: "  LOSARTÁN ", limit: 50 });

      expect(plain.items).toHaveLength(expected.length);
      expect(plain.items.every((item) => item.activeIngredient.startsWith("Losartán"))).toBe(true);
      expect(accented.items.map((item) => item.id)).toEqual(plain.items.map((item) => item.id));
    });

    it("finds by active ingredient: 'pregabalina' returns brand and generic versions", async () => {
      const { items } = await caller.catalog.search({ q: "pregabalina", limit: 50 });

      expect(items).toHaveLength(expectedFor("pregabalina").length);
      expect(new Set(items.map((item) => item.activeIngredient))).toEqual(new Set(["Pregabalina"]));
      const names = items.map((item) => item.commercialName);
      expect(names).toContain("Pregalis");
      expect(names.some((name) => name.startsWith("Pregabalina "))).toBe(true);
    });

    it("finds by commercial name: 'tensivar' returns only that brand", async () => {
      const { items } = await caller.catalog.search({ q: "Tensivar", limit: 50 });

      expect(items.length).toBe(expectedFor("tensivar").length);
      expect(items.length).toBeGreaterThan(0);
      expect(items.every((item) => item.commercialName === "Tensivar")).toBe(true);
    });

    it("matches every word of a multi-word term in any position ('celecoxib 200')", async () => {
      const { items } = await caller.catalog.search({ q: "celecoxib 200", limit: 50 });
      const reversed = await caller.catalog.search({ q: "200 CELECOXIB", limit: 50 });

      const expected = seedProducts.filter(
        (product) =>
          product.activeIngredient === "Celecoxib" && product.presentation.includes("200"),
      );
      expect(expected.length).toBeGreaterThan(0);
      expect(items).toHaveLength(expected.length);
      expect(items.every((item) => item.presentation.includes("200 mg"))).toBe(true);
      expect(new Set(reversed.items.map((item) => item.id))).toEqual(
        new Set(items.map((item) => item.id)),
      );
    });

    it("narrows by dose: 'losartan 100' excludes the 50 mg presentations", async () => {
      const { items } = await caller.catalog.search({ q: "losartan 100", limit: 50 });

      expect(items.length).toBeGreaterThan(0);
      expect(items.every((item) => item.presentation.includes("100 mg"))).toBe(true);
    });

    it("shows price and availability computed from inventory, with only public fields", async () => {
      const { items } = await caller.catalog.search({ q: "melatonina", limit: 50 });

      expect(items.length).toBeGreaterThan(0);
      for (const item of items) {
        expect(Object.keys(item).sort()).toEqual(PUBLIC_FIELDS);
        expect(item.priceClp).toBeGreaterThan(0);
        expect(["available", "low", "out"]).toContain(item.availability);
      }
      const seeded = await testDb().inventoryItem.findMany({
        where: { productId: { in: items.map((item) => item.id) } },
      });
      for (const item of items) {
        expect(item.availableQty).toBe(seeded.find((row) => row.productId === item.id)?.onHand);
      }
    });

    it("answers an empty page for a term without matches (no error)", async () => {
      await expect(caller.catalog.search({ q: "zzzz inexistente" })).resolves.toEqual({
        items: [],
        nextCursor: null,
      });
    });

    it("pages through the whole active catalog without repeating products", async () => {
      const ids = await collectAllPages(caller, "", 50);

      expect(ids).toHaveLength(seedProducts.length);
      expect(new Set(ids).size).toBe(seedProducts.length);
    });
  });

  describe("ordering, filters and visibility (CAT-I02, CAT-I03)", () => {
    beforeEach(async () => {
      await resetDatabase(testDb());
    });

    const createSartanProducts = async () => ({
      namePrefix: await createProduct(testDb(), {
        commercialName: "Sartanil",
        activeIngredient: "Valsartán",
      }),
      ingredientPrefix: await createProduct(testDb(), {
        commercialName: "Bloqueo Total",
        activeIngredient: "Sartán compuesto",
      }),
      substringA: await createProduct(testDb(), {
        commercialName: "Anti Presión",
        activeIngredient: "Losartán",
      }),
      substringB: await createProduct(testDb(), {
        commercialName: "Cardio Uno",
        activeIngredient: "Irbesartán",
        category: "cardiovascular",
      }),
      inactive: await createProduct(testDb(), {
        commercialName: "Sartan Retirado",
        activeIngredient: "Sartán",
        active: false,
      }),
    });

    it("lists prefix matches (name or ingredient) first, then substrings, each by name", async () => {
      const products = await createSartanProducts();
      const caller = await anonymousCaller(testDb());

      const { items } = await caller.catalog.search({ q: "sartan" });

      expect(items.map((item) => item.id)).toEqual([
        products.ingredientPrefix.id,
        products.namePrefix.id,
        products.substringA.id,
        products.substringB.id,
      ]);
    });

    it("keeps the same order across pages of any size (stable cursor)", async () => {
      await createSartanProducts();
      const caller = await anonymousCaller(testDb());
      const { items } = await caller.catalog.search({ q: "sartan" });
      const expected = items.map((item) => item.id);

      await expect(collectAllPages(caller, "sartan", 1)).resolves.toEqual(expected);
      await expect(collectAllPages(caller, "sartan", 3)).resolves.toEqual(expected);
      const firstPage = await caller.catalog.search({ q: "sartan", limit: 3 });
      expect(firstPage.nextCursor).toBe(expected[2]);
    });

    it("filters by category", async () => {
      const products = await createSartanProducts();
      const caller = await anonymousCaller(testDb());

      const { items } = await caller.catalog.search({ q: "sartan", category: "cardiovascular" });

      expect(items.map((item) => item.id)).toEqual([products.substringB.id]);
    });

    it("lists every active product by name when the term is empty", async () => {
      const products = await createSartanProducts();
      const caller = await anonymousCaller(testDb());

      const { items } = await caller.catalog.search({ q: "   " });

      expect(items.map((item) => item.id)).toEqual([
        products.substringA.id,
        products.ingredientPrefix.id,
        products.substringB.id,
        products.namePrefix.id,
      ]);
    });

    it("hides inactive products from search and byId (NOT_FOUND)", async () => {
      const products = await createSartanProducts();
      const caller = await anonymousCaller(testDb());

      const { items } = await caller.catalog.search({ q: "retirado" });

      expect(items).toEqual([]);
      await expect(caller.catalog.byId({ id: products.inactive.id })).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
      await expect(caller.catalog.byId({ id: "no-existe" })).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
    });

    it("returns the public detail of an active product without a session", async () => {
      const product = await createProduct(testDb(), {
        commercialName: "Ácido Fólico Sur",
        activeIngredient: "Ácido fólico",
        priceClp: 2490,
        onHand: 12,
      });
      const caller = await anonymousCaller(testDb());

      const summary = await caller.catalog.byId({ id: product.id });

      expect(summary).toEqual({
        id: product.id,
        commercialName: "Ácido Fólico Sur",
        activeIngredient: "Ácido fólico",
        presentation: product.presentation,
        category: product.category,
        priceClp: 2490,
        availableQty: 12,
        availability: "available",
      });
      const found = await caller.catalog.search({ q: "ACIDO folico" });
      expect(found.items.map((item) => item.id)).toEqual([product.id]);
    });

    it("computes availability from inventory and its low-stock threshold (R-CAT-06)", async () => {
      const out = await createProduct(testDb(), { commercialName: "Stock A", onHand: 0 });
      const low = await createProduct(testDb(), { commercialName: "Stock B", onHand: 5 });
      const ok = await createProduct(testDb(), { commercialName: "Stock C", onHand: 6 });
      const custom = await createProduct(testDb(), {
        commercialName: "Stock D",
        onHand: 8,
        lowStockThreshold: 10,
      });
      const caller = await anonymousCaller(testDb());

      const before = await caller.catalog.search({ q: "stock" });
      expect(before.items.map((item) => [item.id, item.availableQty, item.availability])).toEqual([
        [out.id, 0, "out"],
        [low.id, 5, "low"],
        [ok.id, 6, "available"],
        [custom.id, 8, "low"],
      ]);

      await setStock(testDb(), ok.id, 2);
      await expect(caller.catalog.byId({ id: ok.id })).resolves.toMatchObject({
        availableQty: 2,
        availability: "low",
      });
    });
  });
});
