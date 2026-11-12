"use client";

import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { useToast } from "../../components/toast-provider";
import { useTRPC } from "../../lib/trpc";
import { adjustmentSuccessMessage } from "./inventory-format";
import { toInventoryListInput, type InventoryFilters } from "./inventory-filters";

/** Movements per "Cargar más" page of a product's ledger. */
export const MOVEMENTS_PAGE_SIZE = 20;

/** Stock list (`inventory.list`): by name, filtered, cursor paginated (HU-10, HU-12). */
export function useInventoryList(filters: InventoryFilters) {
  const trpc = useTRPC();
  return useInfiniteQuery(
    trpc.inventory.list.infiniteQueryOptions(toInventoryListInput(filters), {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
      placeholderData: keepPreviousData,
    }),
  );
}

/** Stock card of one product (`inventory.product`). */
export function useProductStock(productId: string) {
  const trpc = useTRPC();
  return useQuery(trpc.inventory.product.queryOptions({ productId }));
}

/** A product's ledger (`inventory.movements`), newest first (R-INV-16). */
export function useStockMovements(productId: string) {
  const trpc = useTRPC();
  return useInfiniteQuery(
    trpc.inventory.movements.infiniteQueryOptions(
      { productId, limit: MOVEMENTS_PAGE_SIZE },
      { getNextPageParam: (lastPage) => lastPage.nextCursor },
    ),
  );
}

/**
 * `inventory.adjust` (HU-10): on success the product card takes the new stock, every other
 * inventory query (list, ledger, alerts) refreshes and a toast states the resulting stock. Errors
 * (negative stock, validation) are shown by the form.
 */
export function useAdjustStock() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const showToast = useToast();

  return useMutation(
    trpc.inventory.adjust.mutationOptions({
      onSuccess: (result) => {
        const { productId } = result.item;
        queryClient.setQueryData(trpc.inventory.product.queryKey({ productId }), result.item);
        void queryClient.invalidateQueries(trpc.inventory.pathFilter());
        showToast({ tone: "success", message: adjustmentSuccessMessage(result) });
      },
    }),
  );
}
