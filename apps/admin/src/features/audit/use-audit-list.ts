"use client";

import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";

import { useTRPC } from "../../lib/trpc";
import { toAuditInput, type AuditFilters } from "./audit-filters";

/** Audit rows (`audit.list`, admin only), newest first, cursor paginated (R-AUD-06). */
export function useAuditList(filters: AuditFilters) {
  const trpc = useTRPC();
  return useInfiniteQuery(
    trpc.audit.list.infiniteQueryOptions(toAuditInput(filters), {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
      placeholderData: keepPreviousData,
    }),
  );
}
