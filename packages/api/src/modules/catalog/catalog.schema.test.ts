import { describe, expect, it } from "vitest";

import {
  CATALOG_SEARCH_DEFAULT_LIMIT,
  CATALOG_SEARCH_MAX_LENGTH,
  productByIdInput,
  searchCatalogInput,
} from "./catalog.schema";

describe("searchCatalogInput (CAT-U02, R-CAT-09)", () => {
  it("accepts an empty input and defaults the page size to 20", () => {
    expect(searchCatalogInput.parse({})).toEqual({ limit: CATALOG_SEARCH_DEFAULT_LIMIT });
  });

  it("trims the term and accepts exactly 100 characters", () => {
    const term = "a".repeat(CATALOG_SEARCH_MAX_LENGTH);
    expect(searchCatalogInput.parse({ q: `  ${term}  ` }).q).toBe(term);
  });

  it("rejects a term longer than 100 characters with a Spanish message", () => {
    const result = searchCatalogInput.safeParse({ q: "a".repeat(CATALOG_SEARCH_MAX_LENGTH + 1) });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("La búsqueda admite hasta 100 caracteres");
  });

  it.each([0, 51, 1.5])("rejects limit %s (1..50, integer)", (limit) => {
    expect(searchCatalogInput.safeParse({ limit }).success).toBe(false);
  });

  it.each([1, 50])("accepts limit %s", (limit) => {
    expect(searchCatalogInput.parse({ limit }).limit).toBe(limit);
  });

  it("accepts only the closed list of categories", () => {
    expect(searchCatalogInput.parse({ category: "salud-mental" }).category).toBe("salud-mental");
    expect(searchCatalogInput.safeParse({ category: "cosmetica" }).success).toBe(false);
  });

  it("rejects an empty cursor", () => {
    expect(searchCatalogInput.safeParse({ cursor: "  " }).success).toBe(false);
  });
});

describe("productByIdInput", () => {
  it("requires a non-blank id", () => {
    expect(productByIdInput.safeParse({ id: "   " }).success).toBe(false);
    expect(productByIdInput.parse({ id: " abc " })).toEqual({ id: "abc" });
  });

  it("rejects absurdly long ids", () => {
    expect(productByIdInput.safeParse({ id: "x".repeat(65) }).success).toBe(false);
  });
});
