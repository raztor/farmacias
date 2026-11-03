"use client";

import type { RouterOutputs } from "@repo/api";
import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "../../lib/trpc";

export type AdminStats = RouterOutputs["admin"]["stats"];

/** Backoffice KPIs (`admin.stats`). */
export function useAdminStats() {
  const trpc = useTRPC();
  return useQuery(trpc.admin.stats.queryOptions());
}
