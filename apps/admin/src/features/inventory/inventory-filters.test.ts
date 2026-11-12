import { describe, expect, it } from "vitest";

import {
  inventoryResultText,
  inventorySearch,
  parseInventoryFilters,
  productStockHref,
  toInventoryListInput,
} from "./inventory-filters";

describe("parseInventoryFilters", () => {
  it("reads the search and the low-stock flag from the URL", () => {
    expect(parseInventoryFilters({ q: " paracetamol ", bajo: "1" })).toEqual({
      filters: { search: "paracetamol", onlyLow: true },
      searchInput: "paracetamol",
      searchError: null,
    });
  });

  it("ignores unknown flags and reports a too-long search without sending it", () => {
    const parsed = parseInventoryFilters({ q: "x".repeat(101), bajo: "si" });
    expect(parsed.filters).toEqual({ search: "", onlyLow: false });
    expect(parsed.searchError).toBe("La búsqueda admite hasta 100 caracteres.");
  });
});

describe("inventory URL and API input", () => {
  it("round-trips the filters through the query string", () => {
    const filters = { search: "ácido", onlyLow: true };
    expect(inventorySearch(filters)).toBe("?q=%C3%A1cido&bajo=1");
    expect(inventorySearch({ search: "", onlyLow: false })).toBe("");
  });

  it("builds a stable list input without undefined keys", () => {
    expect(toInventoryListInput({ search: "", onlyLow: false })).toEqual({ limit: 20 });
    expect(toInventoryListInput({ search: "losartan", onlyLow: true })).toEqual({
      limit: 20,
      search: "losartan",
      onlyLow: true,
    });
  });

  it("encodes the product id in the stock page link", () => {
    expect(productStockHref("a/b")).toBe("/inventory/a%2Fb");
  });
});

describe("inventoryResultText", () => {
  const base = {
    pending: false,
    count: 0,
    hasMore: false,
    filters: { search: "", onlyLow: false },
  };

  it.each([
    [{ ...base, pending: true }, "Cargando inventario…"],
    [base, "Aún no hay productos con inventario."],
    [
      { ...base, filters: { search: "zinc", onlyLow: true } },
      "No hay productos que cumplan los filtros. Filtros: búsqueda «zinc»; solo stock bajo.",
    ],
    [{ ...base, count: 1 }, "Mostrando 1 producto. Sin filtros: todos los productos."],
    [
      { ...base, count: 20, hasMore: true },
      "Mostrando 20 productos (hay más). Sin filtros: todos los productos.",
    ],
  ])("%j", (state, text) => {
    expect(inventoryResultText(state)).toBe(text);
  });
});
