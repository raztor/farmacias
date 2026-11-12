import { buildProductSearchText } from "@repo/shared";
import { describe, expect, it } from "vitest";

import type { CatalogSeedProduct } from "./catalog-types";
import { seedCatalog, type CatalogSeedClient } from "./seed-catalog";

type UpsertArgs = {
  where: { sku: string };
  create: { sku: string; searchText: string; inventory: { create: { onHand: number } } };
  update: { inventory: { upsert: { update: Record<string, never> } } };
};

/** In-memory stand-in for the two Prisma calls the seed makes. */
function createFakeClient(existingSkus: readonly string[]) {
  const upserts: UpsertArgs[] = [];
  const client = {
    product: {
      findMany: () => Promise.resolve(existingSkus.map((sku) => ({ sku }))),
      upsert: (args: UpsertArgs) => {
        upserts.push(args);
        return Promise.resolve({ id: args.where.sku });
      },
    },
    $transaction: (operations: readonly Promise<unknown>[]) => Promise.all(operations),
  };
  return { client: client as unknown as CatalogSeedClient, upserts };
}

const product = (sku: string, commercialName: string): CatalogSeedProduct => ({
  sku,
  commercialName,
  activeIngredient: "Losartán potásico",
  presentation: "Comprimidos 50 mg x 30",
  category: "cardiovascular",
  priceClp: 4990,
  onHand: 12,
  lowStockThreshold: 5,
});

describe("seedCatalog", () => {
  it("stores search_text with the catalog search normalization of @repo/shared", async () => {
    const { client, upserts } = createFakeClient([]);
    const seeded = product("CAR-LOS-B1", "Cardiotén Ñandú");
    await seedCatalog(client, { products: [seeded] });
    const upsert = upserts[0];
    expect(upsert?.create.searchText).toBe(buildProductSearchText(seeded));
    expect(upsert?.create.searchText).toBe(
      "cardioten nandu losartan potasico comprimidos 50 mg x 30",
    );
  });

  it("counts created and existing products and never touches an existing one", async () => {
    const { client, upserts } = createFakeClient(["CAR-LOS-B1"]);
    const result = await seedCatalog(client, {
      products: [product("CAR-LOS-B1", "Uno"), product("CAR-LOS-G1", "Dos")],
    });
    expect(result).toEqual({ created: 1, existing: 1, total: 2 });
    // Only a missing inventory row may be created: no product field, no stock reset (HU-11).
    expect(upserts.map((args) => Object.keys(args.update))).toEqual([["inventory"], ["inventory"]]);
    expect(upserts.map((args) => args.update.inventory.upsert.update)).toEqual([{}, {}]);
  });

  it("seeds the synthetic demo catalog by default", async () => {
    const { client, upserts } = createFakeClient([]);
    const result = await seedCatalog(client);
    expect(result.total).toBeGreaterThanOrEqual(200);
    expect(upserts).toHaveLength(result.total);
  });
});
