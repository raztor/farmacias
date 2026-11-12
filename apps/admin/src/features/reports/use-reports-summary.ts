"use client";

import type { RouterOutputs } from "@repo/api";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { useTRPC } from "../../lib/trpc";
import { toReportsInput, type ReportsFilters } from "./reports-filters";

export type ReportsSummary = RouterOutputs["reports"]["summary"];

/** Operational reports for the range in the URL (`reports.summary`, admin only, HU-13). */
export function useReportsSummary(filters: ReportsFilters) {
  const trpc = useTRPC();
  return useQuery(
    trpc.reports.summary.queryOptions(toReportsInput(filters), {
      placeholderData: keepPreviousData,
    }),
  );
}
