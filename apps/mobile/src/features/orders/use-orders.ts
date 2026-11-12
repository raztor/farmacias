import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";

import { reportUnexpectedApiError } from "../../lib/report-error";
import { useTRPC } from "../../lib/trpc";
import { cancelOrderOptions, repeatOrderOptions } from "./order-mutations";
import { REPEAT_NOTICE_KEY, type RepeatNotice } from "./repeat-notice";

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

/** HU-14: adds the order's products to the cart, then opens «Mi pedido» with the changes. */
export function useRepeatOrder(order: Readonly<{ code: string; lineCount: number }>) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();
  return useMutation(
    repeatOrderOptions({
      trpc,
      queryClient,
      order,
      onRepeated: () => {
        router.push("/cart");
      },
      onError: reportUnexpectedApiError,
    }),
  );
}

/** The notice of the last "Repetir pedido" (`null` when there is none or it was dismissed). */
export function useRepeatNotice() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: REPEAT_NOTICE_KEY,
    queryFn: (): RepeatNotice | null => null,
    initialData: null,
    staleTime: Infinity,
  });
  const dismiss = () => {
    queryClient.setQueryData<RepeatNotice | null>(REPEAT_NOTICE_KEY, null);
  };
  return { notice: query.data, dismiss };
}

/** Owner cancellation; refreshes the orders and the catalog after any answer (see options). */
export function useCancelOrder() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation(cancelOrderOptions({ trpc, queryClient, onError: reportUnexpectedApiError }));
}
