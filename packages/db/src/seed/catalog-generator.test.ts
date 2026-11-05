import { describe, expect, it } from "vitest";

import { buildCategoryProducts, stableHash, stockForSku, toShelfPrice } from "./catalog-generator";

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

describe("catalog generator", () => {
  it("toShelfPrice rounds to a price ending in 90 with a 990 floor", () => {
    expect(toShelfPrice(6990)).toBe(6990);
    expect(toShelfPrice(3844.5)).toBe(3790);
    expect(toShelfPrice(100)).toBe(990);
  });

  it("stableHash is deterministic and spreads values", () => {
    expect(stableHash("CAR-LOS-B1")).toBe(stableHash("CAR-LOS-B1"));
    expect(stableHash("CAR-LOS-B1")).not.toBe(stableHash("CAR-LOS-B2"));
  });

  it("stockForSku is never negative", () => {
    for (let index = 0; index < 1000; index += 1) {
      const stock = stockForSku(`SKU-${String(index)}`);
      expect(Number.isInteger(stock) && stock >= 0 && stock <= 150).toBe(true);
    }
  });

  it("buildCategoryProducts interleaves ingredients and creates brand + generic", () => {
    const result = buildCategoryProducts(SPEC);
    expect(result.map((product) => product.sku)).toEqual([
      "DIG-AAA-B1",
      "DIG-BBB-B1",
      "DIG-AAA-G1",
    ]);
    const generic = result[2];
    expect(generic?.commercialName).toBe("Uno Cordillera");
    expect(generic?.priceClp).toBe(1090);
    expect(result.every((product) => product.category === "digestivo")).toBe(true);
  });

  it("buildCategoryProducts throws when the specs cannot reach the target", () => {
    expect(() => buildCategoryProducts({ ...SPEC, target: 7 })).toThrow(/yields 6 products/);
  });
});
