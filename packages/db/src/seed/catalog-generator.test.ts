import assert from "node:assert/strict";
import { test } from "node:test";

import { buildCategoryProducts, stableHash, stockForSku, toShelfPrice } from "./catalog-generator";

await test("toShelfPrice rounds to a price ending in 90 with a 990 floor", () => {
  assert.equal(toShelfPrice(6990), 6990);
  assert.equal(toShelfPrice(3844.5), 3790);
  assert.equal(toShelfPrice(100), 990);
});

await test("stableHash is deterministic and spreads values", () => {
  assert.equal(stableHash("CAR-LOS-B1"), stableHash("CAR-LOS-B1"));
  assert.notEqual(stableHash("CAR-LOS-B1"), stableHash("CAR-LOS-B2"));
});

await test("stockForSku is never negative", () => {
  for (let index = 0; index < 1000; index += 1) {
    const stock = stockForSku(`SKU-${index}`);
    assert.ok(Number.isInteger(stock) && stock >= 0 && stock <= 150);
  }
});

const SPEC = {
  category: "digestivo",
  prefix: "DIG",
  target: 3,
  ingredients: [
    {
      code: "AAA",
      activeIngredient: "Uno",
      brand: "Marca Uno",
      variants: [
        ["Comprimidos x 10", 2000],
        ["Comprimidos x 20", 3000],
      ],
    },
    { code: "BBB", activeIngredient: "Dos", brand: "Marca Dos", variants: [["Jarabe", 5000]] },
  ],
} as const;

await test("buildCategoryProducts interleaves ingredients and creates brand + generic", () => {
  const result = buildCategoryProducts(SPEC);
  assert.deepEqual(
    result.map((product) => product.sku),
    ["DIG-AAA-B1", "DIG-BBB-B1", "DIG-AAA-G1"],
  );
  const generic = result[2];
  assert.ok(generic);
  assert.equal(generic.commercialName, "Uno Cordillera");
  assert.equal(generic.priceClp, 1090);
  assert.ok(result.every((product) => product.category === "digestivo"));
});

await test("buildCategoryProducts throws when the specs cannot reach the target", () => {
  assert.throws(() => buildCategoryProducts({ ...SPEC, target: 7 }), /yields 6 products/);
});
