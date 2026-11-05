import { expect, test } from "@playwright/test";

import { laneSnapshot, pickLaneProduct, type CatalogReader } from "../support/orders-api.ts";
import { parseLaneSnapshot } from "../support/product-lanes.ts";
import type { JsonRecord } from "../support/trpc-http.ts";

/**
 * Self-test of the product lanes (no stack): a fake `catalog.search` / `catalog.byId` over an
 * in-memory catalog in name order, like the seed.
 */
type FakeProduct = { id: string; commercialName: string; availableQty: number };

const fakeCatalog = (stock: readonly number[]): FakeProduct[] =>
  stock.map((availableQty, index) => ({
    id: `p-${String(index).padStart(2, "0")}`,
    commercialName: `Producto ${String(index)}`,
    availableQty,
  }));

const toSummary = (product: FakeProduct): JsonRecord => ({
  ...product,
  activeIngredient: `Principio ${product.id}`,
});

/** Pages of 2 items with an index cursor, like the real keyset pagination. */
const fakeApi = (catalog: readonly FakeProduct[]): CatalogReader => ({
  trpc: {
    query: (path, input) => {
      if (path === "catalog.byId") {
        const found = catalog.find((product) => product.id === input?.id);
        if (found === undefined) throw new Error(`unknown product ${String(input?.id)}`);
        return Promise.resolve(toSummary(found));
      }
      const start = typeof input?.cursor === "string" ? Number(input.cursor) : 0;
      const items = catalog.slice(start, start + 2).map(toSummary);
      const nextCursor = start + 2 < catalog.length ? String(start + 2) : null;
      return Promise.resolve({ items, nextCursor });
    },
    mutation: () => Promise.reject(new Error("read-only fake")),
  },
});

test.describe("carriles de productos: verificación de la propia asignación", () => {
  test("un producto que baja de 5 unidades a mitad de la ejecución no corre los carriles siguientes", async () => {
    // p-01 starts with exactly 5 units, like OTR-CET-B1 «Cetiral» in the operatorFlow lane.
    const catalog = fakeCatalog([9, 5, 3, 8, 7, 6]);
    const api = fakeApi(catalog);
    const snapshot = await laneSnapshot(api);
    expect(snapshot).toEqual(["p-00", "p-01", "p-03", "p-04", "p-05"]);
    const before = await pickLaneProduct(api, snapshot, { index: 3 });

    // A test of the run pays one unit of p-01: it now has 4.
    const paid = catalog[1];
    if (paid !== undefined) paid.availableQty = 4;

    // Re-reading the live stock (what pickProduct used to do) would hand index 3 to the
    // neighbouring slot's product; the run's snapshot keeps it.
    expect((await laneSnapshot(api))[3]).not.toBe(before.id);
    const after = await pickLaneProduct(api, snapshot, { index: 3 });
    expect(after.id).toBe(before.id);
    expect(after.id).toBe("p-04");
  });

  test("falla con un mensaje claro fuera de rango o si el producto ya no tiene stock", async () => {
    const catalog = fakeCatalog([9, 6]);
    const api = fakeApi(catalog);
    const snapshot = await laneSnapshot(api);

    await expect(pickLaneProduct(api, snapshot, { index: 2 })).rejects.toThrow(/out of range/);
    const first = catalog[0];
    if (first !== undefined) first.availableQty = 2;
    await expect(pickLaneProduct(api, snapshot, { index: 0 })).rejects.toThrow(/has 2 units/);
  });

  test("valida el archivo de la foto", () => {
    expect(parseLaneSnapshot('["a","b"]')).toEqual(["a", "b"]);
    expect(() => parseLaneSnapshot('{"a":1}')).toThrow(/array of product ids/);
    expect(() => parseLaneSnapshot("[1]")).toThrow(/array of product ids/);
  });
});
