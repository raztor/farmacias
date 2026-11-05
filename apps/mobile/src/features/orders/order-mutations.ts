import type { AppRouter } from "@repo/api";
import type { QueryClient } from "@tanstack/react-query";
import type { TRPCOptionsProxy } from "@trpc/tanstack-react-query";

type CancelOrderDeps = Readonly<{
  trpc: TRPCOptionsProxy<AppRouter>;
  queryClient: QueryClient;
  onError: (error: unknown) => void;
}>;

/**
 * Options of the owner cancellation (`orders.cancel`). The orders are refreshed whatever the
 * answer: on success the status changed (and a paid order restored stock); on a CONFLICT
 * (`STALE_VERSION`, `INVALID_TRANSITION`) the order changed elsewhere, and only a refetch brings
 * the current status, actions and `version` — retrying with the cached version would fail again.
 */
export function cancelOrderOptions({ trpc, queryClient, onError }: CancelOrderDeps) {
  return trpc.orders.cancel.mutationOptions({
    onError,
    onSettled: () => {
      void queryClient.invalidateQueries(trpc.orders.pathFilter());
      void queryClient.invalidateQueries(trpc.catalog.pathFilter());
    },
  });
}
