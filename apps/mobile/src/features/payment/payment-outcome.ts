import type { PaymentResult } from "@repo/api";

import {
  getApiErrorCode,
  getApiErrorReason,
  getApiErrorText,
  isOutcomeUnknown,
} from "../../lib/api-error";
import { getApiErrorMessage } from "../../lib/error-message";

/** What the payment screen shows after an attempt. */
export type PaymentOutcome =
  | Readonly<{ kind: "approved"; message: string; replayed: boolean }>
  | Readonly<{ kind: "rejected"; message: string; replayed: boolean }>
  /** HU-06 #2: no stock left for a line; nothing was discounted and the order kept its status. */
  | Readonly<{ kind: "stock_conflict"; message: string }>
  /** The order no longer accepts payments (already paid elsewhere, cancelled…). */
  | Readonly<{ kind: "not_payable"; message: string }>
  /** Definitive error (validation, not found…): a new attempt may be started. */
  | Readonly<{ kind: "failed"; message: string }>
  /** No answer (network, server error): retry with the same idempotency key. */
  | Readonly<{ kind: "unknown"; message: string }>;

/**
 * Shown for every unknown outcome (no answer, timeout, rate limit, server error), so it names no
 * cause: the connection may have worked (RNF-09). Waiting a moment also suits a 429.
 */
export const UNKNOWN_OUTCOME_MESSAGE =
  "No pudimos confirmar el resultado del pago. Espera un momento y usa «Reintentar»: es " +
  "seguro, tu pedido no se pagará ni se descontará dos veces.";

/** Successful answer of `payments.pay` (approved or rejected, possibly a replay). Pure. */
export function outcomeFromResult(result: PaymentResult): PaymentOutcome {
  return { kind: result.outcome, message: result.message, replayed: result.replayed };
}

const STOCK_CONFLICT_TEXT = /stock/iu;
const NOT_PAYABLE_TEXT = /no admite pagos/iu;

/**
 * Error of `payments.pay`. The API's `reason` is used when present; otherwise the CONFLICT
 * message tells stock conflicts and non-payable orders apart. Pure.
 */
export function outcomeFromError(error: unknown): PaymentOutcome {
  if (isOutcomeUnknown(error)) return { kind: "unknown", message: UNKNOWN_OUTCOME_MESSAGE };
  const message = getApiErrorMessage(error);
  const reason = getApiErrorReason(error);
  const isConflict = getApiErrorCode(error) === "CONFLICT";
  const text = getApiErrorText(error);
  if (reason === "STOCK_CONFLICT" || (isConflict && STOCK_CONFLICT_TEXT.test(text))) {
    return { kind: "stock_conflict", message };
  }
  if (reason === "ORDER_NOT_PAYABLE" || (isConflict && NOT_PAYABLE_TEXT.test(text))) {
    return { kind: "not_payable", message };
  }
  return { kind: "failed", message };
}

/** Only an unknown outcome keeps the attempt (and its key) for a retry. Pure. */
export function keepsAttemptKey(outcome: PaymentOutcome): boolean {
  return outcome.kind === "unknown";
}
