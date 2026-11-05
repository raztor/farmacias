import type { ProductCategory } from "@repo/shared";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

import { useTRPC } from "../../lib/trpc";

export const CATALOG_PAGE_SIZE = 20;

type CatalogFilters = Readonly<{ q: string; category: ProductCategory | null }>;

/** Public catalog search (HU-01), paginated by cursor. A blank term lists every product. */
export function useCatalogSearch({ q, category }: CatalogFilters) {
  const trpc = useTRPC();
  const term = q.trim();
  return useInfiniteQuery(
    trpc.catalog.search.infiniteQueryOptions(
      {
        limit: CATALOG_PAGE_SIZE,
        ...(term.length > 0 ? { q: term } : {}),
        ...(category === null ? {} : { category }),
      },
      { getNextPageParam: (page) => page.nextCursor },
    ),
  );
}

/** One public product (`catalog.byId`). */
export function useProduct(id: string) {
  const trpc = useTRPC();
  return useQuery(trpc.catalog.byId.queryOptions({ id }));
}
