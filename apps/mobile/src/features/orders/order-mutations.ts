import type { AppRouter } from "@repo/api";
import type { QueryClient } from "@tanstack/react-query";
import type { TRPCOptionsProxy } from "@trpc/tanstack-react-query";

import { REPEAT_NOTICE_KEY, type RepeatNotice } from "./repeat-notice";

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

type RepeatOrderDeps = Readonly<{
  trpc: TRPCOptionsProxy<AppRouter>;
  queryClient: QueryClient;
  order: Readonly<{ code: string; lineCount: number }>;
  /** Called after the cache was updated (the screen navigates to the cart). */
  onRepeated: () => void;
  onError: (error: unknown) => void;
}>;

/**
 * Options of "Repetir pedido" (`orders.repeat`, HU-14): the returned draft replaces the cached
 * cart (like every draft mutation) and the changes are stored for the cart notice. The catalog is
 * refreshed too, since the answer may reveal stock changes.
 */
export function repeatOrderOptions({
  trpc,
  queryClient,
  order,
  onRepeated,
  onError,
}: RepeatOrderDeps) {
  return trpc.orders.repeat.mutationOptions({
    onError,
    onSuccess: ({ draft, changes }) => {
      queryClient.setQueryData(trpc.orders.draft.queryKey(), draft);
      const notice: RepeatNotice = {
        orderCode: order.code,
        draftId: draft?.id ?? null,
        lineCount: order.lineCount,
        changes,
      };
      queryClient.setQueryData(REPEAT_NOTICE_KEY, notice);
      void queryClient.invalidateQueries(trpc.catalog.pathFilter());
      onRepeated();
    },
  });
}

/** Drops the "Repetir pedido" notice (e.g. once its cart was confirmed, HU-14). */
export function clearRepeatNotice(queryClient: Pick<QueryClient, "setQueryData">): void {
  queryClient.setQueryData<RepeatNotice | null>(REPEAT_NOTICE_KEY, null);
}
