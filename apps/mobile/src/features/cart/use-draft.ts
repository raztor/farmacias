import type { OrderDraft } from "@repo/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { reportUnexpectedApiError } from "../../lib/report-error";
import { useTRPC } from "../../lib/trpc";

/** The resident's cart (`orders.draft`): `null` when there is none. Only with a session. */
export function useDraft(enabled = true) {
  const trpc = useTRPC();
  return useQuery(trpc.orders.draft.queryOptions(undefined, { enabled }));
}

/** Every draft mutation returns the updated cart: write it into the `orders.draft` cache. */
function useWriteDraft() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return (draft: OrderDraft) => {
    queryClient.setQueryData(trpc.orders.draft.queryKey(), draft);
  };
}

/** HU-03: adds units of a product (the API rejects more than available with the max allowed). */
export function useAddItem() {
  const trpc = useTRPC();
  const writeDraft = useWriteDraft();
  return useMutation(
    trpc.orders.addItem.mutationOptions({
      onSuccess: writeDraft,
      onError: reportUnexpectedApiError,
    }),
  );
}

export function useSetQuantity() {
  const trpc = useTRPC();
  const writeDraft = useWriteDraft();
  return useMutation(
    trpc.orders.setQuantity.mutationOptions({
      onSuccess: writeDraft,
      onError: reportUnexpectedApiError,
    }),
  );
}

export function useRemoveItem() {
  const trpc = useTRPC();
  const writeDraft = useWriteDraft();
  return useMutation(
    trpc.orders.removeItem.mutationOptions({
      onSuccess: writeDraft,
      onError: reportUnexpectedApiError,
    }),
  );
}

/** Units of the cart, for the navigation badge (0 without a session or cart). */
export function useCartItemCount(enabled: boolean): number {
  const draft = useDraft(enabled);
  return enabled ? (draft.data?.itemCount ?? 0) : 0;
}
