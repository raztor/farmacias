"use client";

import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";

import { useTRPC } from "../../lib/trpc";
import { toQueueInput, type QueueFilters } from "./queue-filters";

/** Back-office queue (`operations.queue`): FIFO, filtered, cursor paginated (HU-07). */
export function useOrdersQueue(filters: QueueFilters) {
  const trpc = useTRPC();
  return useInfiniteQuery(
    trpc.operations.queue.infiniteQueryOptions(toQueueInput(filters), {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
      // Keep the previous rows on screen while new filters load.
      placeholderData: keepPreviousData,
    }),
  );
}
