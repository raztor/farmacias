"use client";

import type { AdminProductStatus } from "@repo/api";
import { keepPreviousData, useInfiniteQuery, useQuery } from "@tanstack/react-query";

import { useTRPC } from "../../lib/trpc";

/** Products per "load more" page. */
export const PRODUCTS_PAGE_SIZE = 20;

/** Cursor-paginated product list (`catalog.adminList`): active and inactive, by name. */
export function useProductsList(q: string | undefined, status: AdminProductStatus) {
  const trpc = useTRPC();
  return useInfiniteQuery(
    trpc.catalog.adminList.infiniteQueryOptions(
      { limit: PRODUCTS_PAGE_SIZE, q, status },
      {
        getNextPageParam: (lastPage) => lastPage.nextCursor,
        // Keep showing the previous results while a new search loads.
        placeholderData: keepPreviousData,
      },
    ),
  );
}

/** One product for the edit page (`catalog.adminById`), active or not. */
export function useAdminProduct(productId: string) {
  const trpc = useTRPC();
  return useQuery(trpc.catalog.adminById.queryOptions({ id: productId }));
}
