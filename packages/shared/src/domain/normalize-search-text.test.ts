import { describe, expect, it } from "vitest";

import { buildProductSearchText, normalizeSearchText } from "./normalize-search-text";

describe("normalizeSearchText", () => {
  it("lowercases and removes accents, including ñ", () => {
    expect(normalizeSearchText("Losartán Potásico")).toBe("losartan potasico");
    expect(normalizeSearchText("PEÑALOLÉN Ü")).toBe("penalolen u");
  });

  it("collapses punctuation and whitespace runs into single spaces", () => {
    expect(normalizeSearchText("  Comprimidos   50 mg x 30  ")).toBe("comprimidos 50 mg x 30");
    expect(normalizeSearchText("Vitamina D3 / 1.000 UI - gotas")).toBe(
      "vitamina d3 1 000 ui gotas",
    );
  });

  it("returns an empty string for blank or symbol-only input", () => {
    expect(normalizeSearchText("")).toBe("");
    expect(normalizeSearchText("   ")).toBe("");
    expect(normalizeSearchText("%_*")).toBe("");
  });

  it("is idempotent", () => {
    const once = normalizeSearchText("Escitalopram 10 mg — Ánimo");
    expect(normalizeSearchText(once)).toBe(once);
  });

  it("makes accented and unaccented queries match the same stored text", () => {
    const stored = normalizeSearchText("Melatonina Nocturna 3 mg");
    expect(stored).toContain(normalizeSearchText("melatonína"));
    expect(stored).toContain(normalizeSearchText("NOCTURNA"));
  });
});

describe("buildProductSearchText", () => {
  it("joins commercial name, active ingredient and presentation, normalized", () => {
    expect(
      buildProductSearchText({
        commercialName: "Pregabix",
        activeIngredient: "Pregabalina",
        presentation: "Cápsulas 75 mg x 28",
      }),
    ).toBe("pregabix pregabalina capsulas 75 mg x 28");
  });
});
