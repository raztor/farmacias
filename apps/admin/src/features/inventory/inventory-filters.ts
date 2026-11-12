import {
  readFirst,
  toSearch,
  type SearchPair,
  type SearchParamsRecord,
} from "../../lib/search-params";

/** Back-office stock list (HU-10, HU-12). */
export const INVENTORY_PATH = "/inventory";

/** Products per "Cargar más" page. */
export const INVENTORY_PAGE_SIZE = 20;

/** Same limit as the API's `inventory.list` search. */
export const INVENTORY_SEARCH_MAX_LENGTH = 100;

/** Query parameters of the inventory URL (shareable, survives reloads). */
export const INVENTORY_PARAMS = { search: "q", onlyLow: "bajo" } as const;

export type InventoryFilters = Readonly<{
  /** Trimmed search; `""` = no search. */
  search: string;
  /** Only products at or under their low-stock threshold. */
  onlyLow: boolean;
}>;

export type ParsedInventoryFilters = Readonly<{
  filters: InventoryFilters;
  /** What the person typed (for the field), even when invalid. */
  searchInput: string;
  /** Why the search was ignored, or `null`. */
  searchError: string | null;
}>;

/** Stock page of a product. */
export const productStockHref = (productId: string): string =>
  `${INVENTORY_PATH}/${encodeURIComponent(productId)}`;

/** Inventory filters from the page URL; a too-long search is reported and not sent. Pure. */
export function parseInventoryFilters(params: SearchParamsRecord): ParsedInventoryFilters {
  const searchInput = readFirst(params, INVENTORY_PARAMS.search) ?? "";
  const searchError =
    searchInput.length > INVENTORY_SEARCH_MAX_LENGTH
      ? `La búsqueda admite hasta ${String(INVENTORY_SEARCH_MAX_LENGTH)} caracteres.`
      : null;
  return {
    filters: {
      search: searchError === null ? searchInput : "",
      onlyLow: readFirst(params, INVENTORY_PARAMS.onlyLow) === "1",
    },
    searchInput,
    searchError,
  };
}

/** Query string of the inventory for these filters (`""` without filters). Pure. */
export function inventorySearch(filters: InventoryFilters): string {
  const pairs: SearchPair[] = [];
  if (filters.search !== "") pairs.push([INVENTORY_PARAMS.search, filters.search]);
  if (filters.onlyLow) pairs.push([INVENTORY_PARAMS.onlyLow, "1"]);
  return toSearch(pairs);
}

/** Input of `inventory.list` (no `undefined` keys, so the query key stays stable). Pure. */
export function toInventoryListInput(filters: InventoryFilters) {
  return {
    limit: INVENTORY_PAGE_SIZE,
    ...(filters.search === "" ? {} : { search: filters.search }),
    ...(filters.onlyLow ? { onlyLow: true } : {}),
  };
}

export function hasActiveInventoryFilters(filters: InventoryFilters): boolean {
  return filters.search !== "" || filters.onlyLow;
}

const describeFilters = (filters: InventoryFilters): string => {
  const parts: string[] = [];
  if (filters.search !== "") parts.push(`búsqueda «${filters.search}»`);
  if (filters.onlyLow) parts.push("solo stock bajo");
  return parts.length === 0 ? "Sin filtros: todos los productos." : `Filtros: ${parts.join("; ")}.`;
};

/** Text of the results live region: loading, empty or how many products are shown. Pure. */
export function inventoryResultText(
  state: Readonly<{ pending: boolean; count: number; hasMore: boolean; filters: InventoryFilters }>,
): string {
  if (state.pending) return "Cargando inventario…";
  const filtersText = describeFilters(state.filters);
  if (state.count === 0) {
    return hasActiveInventoryFilters(state.filters)
      ? `No hay productos que cumplan los filtros. ${filtersText}`
      : "Aún no hay productos con inventario.";
  }
  const shown =
    state.count === 1 ? "Mostrando 1 producto" : `Mostrando ${String(state.count)} productos`;
  return `${shown}${state.hasMore ? " (hay más)" : ""}. ${filtersText}`;
}
