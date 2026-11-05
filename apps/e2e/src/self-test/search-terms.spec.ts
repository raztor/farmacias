import { expect, test } from "@playwright/test";

import { hasDiacritics, stripDiacritics } from "../support/search-terms.ts";

test.describe("términos de búsqueda: verificación de los helpers", () => {
  test("quita tildes y detecta si un texto las tiene", () => {
    expect(stripDiacritics("Losartán potásico")).toBe("Losartan potasico");
    expect(stripDiacritics("Ácido acetilsalicílico")).toBe("Acido acetilsalicilico");
    expect(hasDiacritics("Bupropión")).toBe(true);
    expect(hasDiacritics("Omeprazol")).toBe(false);
    expect(hasDiacritics("Omega 3 (EPA + DHA)")).toBe(false);
  });
});
