import type { RouterInputs } from "@repo/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";

import { reportUnexpectedApiError } from "../../lib/report-error";
import { clearRepeatNotice } from "../orders";
import { useTRPC, useTRPCClient } from "../../lib/trpc";

type SetFulfillmentInput = RouterInputs["orders"]["setFulfillment"];

/**
 * HU-04: saves the fulfillment (`orders.setFulfillment`) and confirms the draft with the version
 * it returned (`orders.confirm`: draft → pending_payment). Then goes to the simulated payment.
 */
export function useSubmitCheckout() {
  const trpc = useTRPC();
  const client = useTRPCClient();
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: async (input: SetFulfillmentInput) => {
      const draft = await client.orders.setFulfillment.mutate(input);
      return client.orders.confirm.mutate({ expectedVersion: draft.version });
    },
    onSuccess: (order) => {
      queryClient.setQueryData(trpc.orders.draft.queryKey(), null);
      // The cart was placed: a "Repetir pedido" notice about it no longer applies (HU-14).
      clearRepeatNotice(queryClient);
      void queryClient.invalidateQueries(trpc.orders.mine.pathFilter());
      router.replace(`/pay/${order.id}`);
    },
    onError: (error) => {
      // The fulfillment may have been saved before `confirm` failed: reload the cart.
      void queryClient.invalidateQueries({ queryKey: trpc.orders.draft.queryKey() });
      reportUnexpectedApiError(error);
    },
  });
}
