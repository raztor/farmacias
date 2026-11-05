import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { reportUnexpectedApiError } from "../../lib/report-error";
import { useTRPC } from "../../lib/trpc";
import { paymentAttempts, type PaymentScenario } from "./payment-attempts";
import {
  keepsAttemptKey,
  outcomeFromError,
  outcomeFromResult,
  type PaymentOutcome,
} from "./payment-outcome";

export type PaymentController = Readonly<{
  pay: (scenario: PaymentScenario) => void;
  retry: () => void;
  startOver: () => void;
  outcome: PaymentOutcome | null;
  scenario: PaymentScenario | null;
  isPending: boolean;
}>;

/**
 * Simulated payment of an order (HU-05). Each attempt sends an idempotency key: a retry after an
 * unknown outcome reuses it (no double charge or discount), a new attempt gets a new one.
 */
export function usePayment(orderId: string): PaymentController {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [outcome, setOutcome] = useState<PaymentOutcome | null>(null);
  const [scenario, setScenario] = useState<PaymentScenario | null>(null);

  const mutation = useMutation(
    trpc.payments.pay.mutationOptions({
      onSettled: () => {
        // Status, timeline and stock may have changed.
        void queryClient.invalidateQueries(trpc.orders.pathFilter());
        void queryClient.invalidateQueries(trpc.catalog.pathFilter());
      },
    }),
  );

  const pay = (chosen: PaymentScenario) => {
    const idempotencyKey = paymentAttempts.keyFor(orderId, chosen);
    setScenario(chosen);
    setOutcome(null);
    mutation.mutate(
      { orderId, idempotencyKey, scenario: chosen },
      {
        onSuccess: (result) => {
          paymentAttempts.settle(orderId);
          setOutcome(outcomeFromResult(result));
        },
        onError: (error) => {
          const next = outcomeFromError(error);
          if (keepsAttemptKey(next)) reportUnexpectedApiError(error);
          else paymentAttempts.settle(orderId);
          setOutcome(next);
        },
      },
    );
  };

  return {
    pay,
    /** Same attempt again (same scenario, same key while its outcome is unknown). */
    retry: () => {
      if (scenario !== null) pay(scenario);
    },
    /** Back to the two scenario buttons for a new attempt. */
    startOver: () => {
      setOutcome(null);
      mutation.reset();
    },
    outcome,
    scenario,
    isPending: mutation.isPending,
  };
}
