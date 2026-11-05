import { createOneOfGuard } from "./one-of";

/**
 * Result of a simulated payment attempt (`payments.status`, CHECK `payments_status_check`).
 * `stock_conflict`: approved by the gateway but another order took the last units, so nothing
 * was discounted and the order kept its status (HU-06).
 */
export const PAYMENT_STATUSES = ["approved", "rejected", "stock_conflict"] as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const isPaymentStatus = createOneOfGuard(PAYMENT_STATUSES);
