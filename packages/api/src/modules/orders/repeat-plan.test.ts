import { describe, expect, it } from "vitest";

import { planRepeat, type RepeatAvailability } from "./repeat-plan";

const product = (overrides: Partial<RepeatAvailability> & { productId: string }) => ({
  commercialName: `Producto ${overrides.productId}`,
  active: true,
  onHand: 10,
  ...overrides,
});

describe("planRepeat (HU-14, D-30)", () => {
  it("adds every line in full when stock allows, with no changes", () => {
    const plan = planRepeat(
      [
        { productId: "a", quantity: 2 },
        { productId: "b", quantity: 1 },
      ],
      [product({ productId: "a" }), product({ productId: "b" })],
      [],
    );

    expect(plan).toEqual({
      additions: [
        { productId: "a", added: 2, quantity: 2 },
        { productId: "b", added: 1, quantity: 1 },
      ],
      changes: [],
    });
  });

  it("sums on top of the draft line when it fits", () => {
    const plan = planRepeat(
      [{ productId: "a", quantity: 3 }],
      [product({ productId: "a", onHand: 10 })],
      [{ productId: "a", quantity: 4 }],
    );

    expect(plan).toEqual({ additions: [{ productId: "a", added: 3, quantity: 7 }], changes: [] });
  });

  it("reduces to the units on hand", () => {
    const plan = planRepeat(
      [{ productId: "a", quantity: 5 }],
      [product({ productId: "a", commercialName: "Paracetamol 500 mg", onHand: 2 })],
      [],
    );

    expect(plan).toEqual({
      additions: [{ productId: "a", added: 2, quantity: 2 }],
      changes: [
        {
          productId: "a",
          commercialName: "Paracetamol 500 mg",
          requested: 5,
          added: 2,
          reason: "reduced",
        },
      ],
    });
  });

  it("reduces by stock counting what the draft already holds", () => {
    const plan = planRepeat(
      [{ productId: "a", quantity: 4 }],
      [product({ productId: "a", onHand: 5 })],
      [{ productId: "a", quantity: 3 }],
    );

    expect(plan.additions).toEqual([{ productId: "a", added: 2, quantity: 5 }]);
    expect(plan.changes).toMatchObject([{ requested: 4, added: 2, reason: "reduced" }]);
  });

  it("reduces by the 99-units line cap combined with the draft quantity", () => {
    const plan = planRepeat(
      [{ productId: "a", quantity: 30 }],
      [product({ productId: "a", onHand: 500 })],
      [{ productId: "a", quantity: 80 }],
    );

    expect(plan.additions).toEqual([{ productId: "a", added: 19, quantity: 99 }]);
    expect(plan.changes).toMatchObject([{ requested: 30, added: 19, reason: "reduced" }]);
  });

  it("reports `reduced` with nothing added when the draft already holds every allowed unit", () => {
    const plan = planRepeat(
      [{ productId: "a", quantity: 2 }],
      [product({ productId: "a", onHand: 3 })],
      [{ productId: "a", quantity: 3 }],
    );

    expect(plan).toEqual({
      additions: [],
      changes: [
        { productId: "a", commercialName: "Producto a", requested: 2, added: 0, reason: "reduced" },
      ],
    });
  });

  it("skips products without stock as `unavailable`", () => {
    const plan = planRepeat(
      [{ productId: "a", quantity: 1 }],
      [product({ productId: "a", commercialName: "Ibuprofeno", onHand: 0 })],
      [],
    );

    expect(plan).toEqual({
      additions: [],
      changes: [
        {
          productId: "a",
          commercialName: "Ibuprofeno",
          requested: 1,
          added: 0,
          reason: "unavailable",
        },
      ],
    });
  });

  it("skips inactive products as `inactive` even with stock", () => {
    const plan = planRepeat(
      [{ productId: "a", quantity: 2 }],
      [product({ productId: "a", active: false, onHand: 50 })],
      [],
    );

    expect(plan.additions).toEqual([]);
    expect(plan.changes).toMatchObject([{ productId: "a", added: 0, reason: "inactive" }]);
  });

  it("treats a product missing from the catalog as `inactive`", () => {
    const plan = planRepeat([{ productId: "gone", quantity: 1 }], [], []);

    expect(plan.changes).toEqual([
      { productId: "gone", commercialName: "Producto", requested: 1, added: 0, reason: "inactive" },
    ]);
  });

  it("plans each line independently, keeping the previous order's line order", () => {
    const plan = planRepeat(
      [
        { productId: "inactive", quantity: 1 },
        { productId: "full", quantity: 2 },
        { productId: "short", quantity: 4 },
        { productId: "out", quantity: 1 },
      ],
      [
        product({ productId: "inactive", active: false }),
        product({ productId: "full" }),
        product({ productId: "short", onHand: 1 }),
        product({ productId: "out", onHand: 0 }),
      ],
      [{ productId: "other", quantity: 5 }],
    );

    expect(plan.additions.map((addition) => addition.productId)).toEqual(["full", "short"]);
    expect(plan.changes.map((change) => [change.productId, change.reason])).toEqual([
      ["inactive", "inactive"],
      ["short", "reduced"],
      ["out", "unavailable"],
    ]);
  });
});
