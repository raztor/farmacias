"use client";

import type { OperationsOrderDetail, OperatorTarget } from "@repo/api";
import { useRef, useState } from "react";

import { getTrpcErrorMessage, isConflictError } from "../../lib/trpc-errors";
import { transitionActionsFor } from "./transition-actions";
import { TransitionButtons } from "./transition-buttons";
import { TransitionConfirm } from "./transition-confirm";
import { useTransitionOrder } from "./use-order-detail";

type TransitionPanelProps = Readonly<{ order: OperationsOrderDetail }>;

/**
 * "Registrar avance" (HU-08): one button per transition the API allows for this role and
 * modality — never any other — each going through {@link TransitionConfirm}. Errors stay in the
 * panel; on a version conflict the detail reloads and the confirmation closes.
 */
export function TransitionPanel({ order }: TransitionPanelProps) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [selected, setSelected] = useState<OperatorTarget | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { transition, isPending } = useTransitionOrder();

  const actions = transitionActionsFor(order.allowedTransitions);
  const selectedAction = actions.find((action) => action.to === selected) ?? null;

  const close = () => {
    setSelected(null);
    titleRef.current?.focus();
  };

  const onError = (cause: unknown) => {
    setError(getTrpcErrorMessage(cause));
    if (isConflictError(cause)) close();
  };

  return (
    <section aria-labelledby="transition-title" className="flex flex-col gap-3">
      <h2
        id="transition-title"
        ref={titleRef}
        tabIndex={-1}
        className="text-xl font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Registrar avance
      </h2>
      {error === null ? null : (
        <p
          role="alert"
          className="rounded-md border border-destructive p-3 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      {selectedAction === null ? (
        <TransitionButtons
          status={order.status}
          actions={actions}
          onSelect={(to) => {
            setError(null);
            setSelected(to);
          }}
        />
      ) : (
        <TransitionConfirm
          order={order}
          action={selectedAction}
          pending={isPending}
          onConfirm={(note) => {
            setError(null);
            transition({ order, to: selectedAction.to, note }, { onSuccess: close, onError });
          }}
          onCancel={close}
        />
      )}
    </section>
  );
}
