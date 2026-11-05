import { AppError, normalizeSearchText } from "@repo/shared";

import type { ApiDependencies } from "../../trpc";
import {
  createCatalogRepository,
  type CatalogProductRow,
  type CatalogRepository,
} from "./catalog.repository";
import type {
  CatalogSearchQuery,
  CatalogSearchResult,
  ProductAvailability,
  ProductSummary,
} from "./catalog.schema";

export type CatalogServiceDeps = {
  repo: CatalogRepository;
};

export type CatalogService = {
  /** Public search (HU-01): an unknown term returns `items: []`, never an error. */
  search: (query: CatalogSearchQuery) => Promise<CatalogSearchResult>;
  /** Public detail of an active product. Missing or inactive: NOT_FOUND. */
  byId: (id: string) => Promise<ProductSummary>;
};

export const PRODUCT_NOT_FOUND_MESSAGE = "No encontramos ese producto en el catálogo.";

/**
 * R-CAT-06: `out` when nothing is on hand, `low` when the units on hand are at or below the
 * product's threshold, `available` otherwise.
 */
export const toAvailability = (
  availableQty: number,
  lowStockThreshold: number,
): ProductAvailability => {
  if (availableQty <= 0) return "out";
  if (availableQty <= lowStockThreshold) return "low";
  return "available";
};

/** Public projection of a row (R-CAT-07): the stock threshold never leaves the server. */
export const toProductSummary = (row: CatalogProductRow): ProductSummary => {
  const availableQty = Math.max(0, row.onHand);
  return {
    id: row.id,
    commercialName: row.commercialName,
    activeIngredient: row.activeIngredient,
    presentation: row.presentation,
    category: row.category,
    priceClp: row.priceClp,
    availableQty,
    availability: toAvailability(availableQty, row.lowStockThreshold),
  };
};

export const createCatalogService = ({ repo }: CatalogServiceDeps): CatalogService => ({
  search: async ({ q, category, cursor, limit }) => {
    // A term made only of symbols normalizes to "" and behaves like an empty search.
    const term = q === undefined ? "" : normalizeSearchText(q);
    const rows = await repo.search({ term: term || undefined, category, cursor, take: limit + 1 });
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    return {
      items: page.map(toProductSummary),
      nextCursor: hasMore ? (page.at(-1)?.id ?? null) : null,
    };
  },

  byId: async (id) => {
    const row = await repo.findActiveById(id);
    if (!row) throw new AppError("NOT_FOUND", PRODUCT_NOT_FOUND_MESSAGE);
    return toProductSummary(row);
  },
});

/** Wires the service to its Prisma repository. */
export const createCatalogServiceFromDeps = ({ db }: Pick<ApiDependencies, "db">): CatalogService =>
  createCatalogService({ repo: createCatalogRepository(db) });
