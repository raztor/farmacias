import { describe, expect, it } from "vitest";

import { availabilityView } from "./availability";

describe("availabilityView", () => {
  it("shows available products with text, not only color (HU-01 #1, RNF-01)", () => {
    expect(availabilityView({ availability: "available", availableQty: 40 })).toEqual({
      label: "Disponible",
      tone: "success",
      description: "Hay 40 unidades disponibles en la farmacia.",
    });
  });

  it("warns when few units are left and says how many", () => {
    const view = availabilityView({ availability: "low", availableQty: 1 });

    expect(view.label).toBe("Quedan pocas (1)");
    expect(view.tone).toBe("warning");
    expect(view.description).toBe("Quedan pocas unidades: 1 unidad.");
  });

  it("explains that a product is out of stock", () => {
    const view = availabilityView({ availability: "out", availableQty: 0 });

    expect(view.label).toBe("Sin stock");
    expect(view.tone).toBe("destructive");
    expect(view.description).toMatch(/más tarde/u);
  });

  it("gives every availability a different label and tone", () => {
    const views = (["available", "low", "out"] as const).map((availability) =>
      availabilityView({ availability, availableQty: 3 }),
    );

    expect(new Set(views.map((view) => view.label)).size).toBe(3);
    expect(new Set(views.map((view) => view.tone)).size).toBe(3);
  });
});
