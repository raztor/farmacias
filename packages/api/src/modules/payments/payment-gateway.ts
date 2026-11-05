/**
 * Payment gateway port (RNF-11, docs/specs/payments.md R-PAY-01). Business logic depends only on
 * this type; the MVP plugs in `createSimulatedPaymentGateway` and tests plug in fakes. Replacing
 * it with a real gateway (out of scope, §4.4) does not change the payments service.
 */

/** Result the person picks in the app: explicit and demo friendly (no randomness). */
export const PAYMENT_SCENARIOS = ["approve", "reject"] as const;
export type PaymentScenario = (typeof PAYMENT_SCENARIOS)[number];

export type ChargeRequest = {
  orderId: string;
  /** Confirmed order total in integer CLP (never sent by the client). */
  amountClp: number;
  /** Lets a real gateway de-duplicate retries of the same attempt. */
  idempotencyKey: string;
  scenario: PaymentScenario;
};

export type ChargeOutcome = "approved" | "rejected";

export type ChargeResult = {
  outcome: ChargeOutcome;
  /** Gateway reference, synthetic for the simulator ("SIM-…"). Never card data (R-PAY-12). */
  reference: string;
};

export type PaymentGateway = {
  charge: (request: ChargeRequest) => Promise<ChargeResult>;
};
