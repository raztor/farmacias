"use client";

import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";

import { useTRPC } from "../../lib/trpc";

/** Users per "load more" page. */
export const USERS_PAGE_SIZE = 20;

/** Cursor-paginated user list (`admin.listUsers`), newest first, filtered by `search`. */
export function useUsersList(search: string | undefined) {
  const trpc = useTRPC();
  return useInfiniteQuery(
    trpc.admin.listUsers.infiniteQueryOptions(
      { limit: USERS_PAGE_SIZE, search },
      {
        getNextPageParam: (lastPage) => lastPage.nextCursor,
        // Keep showing the previous results while a new search loads.
        placeholderData: keepPreviousData,
      },
    ),
  );
}
