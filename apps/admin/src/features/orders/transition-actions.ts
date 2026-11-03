import type { OperatorTarget } from "@repo/api";
import type { OrderStatus } from "@repo/shared";
import { z } from "zod";

import { statusLabel } from "./orders-format";

/** Same limit as the API's `operations.transition` note (R-OPS-10). */
export const TRANSITION_NOTE_MAX_LENGTH = 200;

export type TransitionAction = Readonly<{
  to: OperatorTarget;
  /** Button text: what the person does, in plain Spanish. */
  label: string;
  /** Cancelling is irreversible: shown last and styled as destructive. */
  destructive: boolean;
}>;

const ACTION_LABELS: Readonly<Record<OperatorTarget, string>> = {
  in_preparation: "Iniciar preparación",
  ready_for_pickup: "Marcar listo para retiro",
  in_transit: "Despachar (en ruta)",
  delivered: "Marcar entregado",
  not_delivered: "Marcar no entregado",
  cancelled: "Cancelar pedido",
};

/** Display order: progress first, then failure, cancellation always last. */
const ACTION_ORDER: readonly OperatorTarget[] = [
  "in_preparation",
  "ready_for_pickup",
  "in_transit",
  "delivered",
  "not_delivered",
  "cancelled",
];

/**
 * Buttons to render for an order: exactly the `allowedTransitions` computed by the API's state
 * machine for the signed-in role (R-OPS-10). Nothing else is ever offered. Pure.
 */
export function transitionActionsFor(
  allowed: readonly OperatorTarget[],
): readonly TransitionAction[] {
  return ACTION_ORDER.filter((to) => allowed.includes(to)).map((to) => ({
    to,
    label: ACTION_LABELS[to],
    destructive: to === "cancelled",
  }));
}

/** Consequence of cancelling, by origin status (R-OPS-11). */
const cancellationNote = (from: OrderStatus): string =>
  from === "payment_validated"
    ? " El stock descontado por el pago se repondrá automáticamente."
    : from === "not_delivered"
      ? " El stock no se repone automáticamente."
      : "";

/** Text of the confirmation step before registering a transition. Pure. */
export function confirmationMessage(code: string, from: OrderStatus, to: OperatorTarget): string {
  const base = `El pedido ${code} pasará de «${statusLabel(from)}» a «${statusLabel(to)}».`;
  return to === "cancelled" ? `${base}${cancellationNote(from)}` : base;
}

/** Announced after the API confirms the transition. Pure. */
export function transitionSuccessMessage(code: string, to: OrderStatus): string {
  return `Listo: el pedido ${code} quedó en «${statusLabel(to)}».`;
}

/** Optional note of a transition: trimmed, blank = no note, at most 200 characters. */
export const transitionNoteSchema = z
  .string()
  .trim()
  .max(TRANSITION_NOTE_MAX_LENGTH, {
    error: `La nota admite hasta ${String(TRANSITION_NOTE_MAX_LENGTH)} caracteres.`,
  })
  .transform((value) => (value === "" ? undefined : value));
