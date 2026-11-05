import type { OperationsOrderDetail, OperatorTarget } from "@repo/api";
import type { OrderStatus } from "@repo/shared";

import { transitionActionsFor, type TransitionAction } from "./transition-actions";

/**
 * Transition the operator picked, with the order's `version` and `status` at that moment
 * (R-OPS-09, D-15): the confirmation states that status and the request sends that version, so
 * a background refetch can never swap the order the operator decided on.
 */
export type TransitionSelection = Readonly<{
  to: OperatorTarget;
  version: number;
  status: OrderStatus;
  /** Sent to the API: from here on the server's compare-and-set decides (STALE_VERSION). */
  submitted: boolean;
}>;

export type SelectionView =
  | Readonly<{ kind: "idle" }>
  | Readonly<{ kind: "stale" }>
  | Readonly<{ kind: "confirm"; action: TransitionAction; selection: TransitionSelection }>;

/** Shown when the order changes while its confirmation is open (same wording as the API). */
export const STALE_SELECTION_MESSAGE =
  "Este pedido cambió mientras lo revisabas. Revisa su estado actual antes de registrar un avance.";

/** Snapshot taken when the operator picks a transition. Pure. */
export function selectTransition(
  order: Pick<OperationsOrderDetail, "version" | "status">,
  to: OperatorTarget,
): TransitionSelection {
  return { to, version: order.version, status: order.status, submitted: false };
}

/**
 * What the panel shows for the current selection and the latest order data. Before it is sent,
 * a selection is `stale` as soon as the order's version differs from the snapshot (it changed
 * underneath the open confirmation, e.g. a payment was approved) or the target is no longer
 * allowed: the confirmation closes and explains why instead of confirming a different order.
 * Once sent it stays on screen until the API answers (its own success also bumps the version).
 * Pure.
 */
export function resolveSelection(
  selection: TransitionSelection | null,
  order: Pick<OperationsOrderDetail, "version">,
  actions: readonly TransitionAction[],
): SelectionView {
  if (selection === null) return { kind: "idle" };
  const action = selection.submitted
    ? transitionActionsFor([selection.to])[0]
    : actions.find((candidate) => candidate.to === selection.to);
  if (action === undefined) return { kind: "stale" };
  if (!selection.submitted && order.version !== selection.version) return { kind: "stale" };
  return { kind: "confirm", action, selection };
}
