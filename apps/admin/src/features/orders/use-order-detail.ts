"use client";

import type { OperationsOrderDetail, OperatorTarget } from "@repo/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useToast } from "../../components/toast-provider";
import { useTRPC } from "../../lib/trpc";
import { isConflictError } from "../../lib/trpc-errors";
import { transitionSuccessMessage } from "./transition-actions";

/** Order detail for the back office (`operations.order`, R-OPS-05). */
export function useOrderDetail(orderId: string) {
  const trpc = useTRPC();
  return useQuery(trpc.operations.order.queryOptions({ id: orderId }));
}

export type TransitionRequest = Readonly<{
  order: Pick<OperationsOrderDetail, "id" | "version">;
  to: OperatorTarget;
  note: string | undefined;
}>;

/**
 * `operations.transition` (HU-08). Sends the version the operator decided on (`expectedVersion`,
 * snapshot taken when the transition was picked): if someone changed the order first the API answers CONFLICT
 * (`STALE_VERSION`) and the detail is reloaded so only the transitions still allowed show up.
 * On success the cached detail is replaced and every queue page refreshed.
 */
export function useTransitionOrder() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const showToast = useToast();

  const mutation = useMutation(
    trpc.operations.transition.mutationOptions({
      onSuccess: (detail) => {
        queryClient.setQueryData(trpc.operations.order.queryKey({ id: detail.id }), detail);
        void queryClient.invalidateQueries(trpc.operations.queue.pathFilter());
        showToast({
          tone: "success",
          message: transitionSuccessMessage(detail.code, detail.status),
        });
      },
      onError: (error, variables) => {
        if (!isConflictError(error)) return;
        void queryClient.invalidateQueries(trpc.operations.order.queryFilter({ id: variables.id }));
        void queryClient.invalidateQueries(trpc.operations.queue.pathFilter());
      },
    }),
  );

  const transition = (request: TransitionRequest, callbacks: TransitionCallbacks) => {
    mutation.mutate(
      {
        id: request.order.id,
        to: request.to,
        expectedVersion: request.order.version,
        note: request.note,
      },
      callbacks,
    );
  };

  return { transition, isPending: mutation.isPending };
}

export type TransitionCallbacks = Readonly<{
  onSuccess?: () => void;
  onError?: (error: unknown) => void;
}>;
