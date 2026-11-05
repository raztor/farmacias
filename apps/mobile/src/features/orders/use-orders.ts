import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { reportUnexpectedApiError } from "../../lib/report-error";
import { useTRPC } from "../../lib/trpc";
import { cancelOrderOptions } from "./order-mutations";

export const MY_ORDERS_PAGE_SIZE = 20;

/** «Mis pedidos» (`orders.mine`): own non-draft orders, newest first. */
export function useMyOrders() {
  const trpc = useTRPC();
  return useInfiniteQuery(
    trpc.orders.mine.infiniteQueryOptions(
      { limit: MY_ORDERS_PAGE_SIZE },
      { getNextPageParam: (page) => page.nextCursor },
    ),
  );
}

/** Own order with its timeline (`orders.detail`); another account's order is NOT_FOUND. */
export function useOrderDetail(id: string) {
  const trpc = useTRPC();
  return useQuery(trpc.orders.detail.queryOptions({ id }));
}

/** Owner cancellation; refreshes the orders and the catalog after any answer (see options). */
export function useCancelOrder() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation(cancelOrderOptions({ trpc, queryClient, onError: reportUnexpectedApiError }));
}
