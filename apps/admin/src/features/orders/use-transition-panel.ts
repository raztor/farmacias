"use client";

import type { OperationsOrderDetail, OperatorTarget } from "@repo/api";
import { useEffect, useRef, useState } from "react";

import { getTrpcErrorMessage, isConflictError } from "../../lib/trpc-errors";
import { transitionActionsFor } from "./transition-actions";
import {
  STALE_SELECTION_MESSAGE,
  resolveSelection,
  selectTransition,
  type TransitionSelection,
} from "./transition-selection";
import { useTransitionOrder } from "./use-order-detail";

/**
 * State of "Registrar avance": picking a transition snapshots the order's version and status
 * ({@link selectTransition}); the confirmation shows that status and sends that version
 * (R-OPS-09). If the order changes while the confirmation is open (background refetch) it closes
 * with {@link STALE_SELECTION_MESSAGE} and focus returns to the panel title; on a CONFLICT from
 * the API the detail reloads and it closes too.
 */
export function useTransitionPanel(order: OperationsOrderDetail) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [selection, setSelection] = useState<TransitionSelection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { transition, isPending } = useTransitionOrder();

  const actions = transitionActionsFor(order.allowedTransitions);
  const view = resolveSelection(selection, order, actions);
  const stale = view.kind === "stale";

  useEffect(() => {
    if (stale) titleRef.current?.focus();
  }, [stale]);

  const close = () => {
    setSelection(null);
    titleRef.current?.focus();
  };

  const onError = (cause: unknown) => {
    setError(getTrpcErrorMessage(cause));
    if (isConflictError(cause)) close();
    else setSelection((current) => (current === null ? null : { ...current, submitted: false }));
  };

  const select = (to: OperatorTarget) => {
    setError(null);
    setSelection(selectTransition(order, to));
  };

  const confirm = (picked: TransitionSelection, note: string | undefined) => {
    setError(null);
    setSelection({ ...picked, submitted: true });
    transition(
      { order: { id: order.id, version: picked.version }, to: picked.to, note },
      { onSuccess: close, onError },
    );
  };

  return {
    titleRef,
    actions,
    view,
    error: stale ? STALE_SELECTION_MESSAGE : error,
    isPending,
    select,
    confirm,
    close,
  };
}
