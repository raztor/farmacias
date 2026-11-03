import { createUuidV4 } from "../../lib/uuid";

/** Result the resident chooses on the simulated payment screen (`payments.pay#scenario`). */
export type PaymentScenario = "approve" | "reject";

export type PendingAttempt = Readonly<{ scenario: PaymentScenario; key: string }>;

export type PaymentAttemptStore = {
  /**
   * Idempotency key for an attempt (R-PAY-04). Retrying an attempt whose outcome is unknown
   * (same order and scenario) reuses its key, so the API answers with the stored result instead
   * of charging or discounting twice (HU-05 #3); anything else starts a new attempt.
   */
  keyFor: (orderId: string, scenario: PaymentScenario) => string;
  /** The attempt got a definitive answer: the next one must use a new key. */
  settle: (orderId: string) => void;
  /** The attempt still waiting for a definitive answer, if any. */
  pending: (orderId: string) => PendingAttempt | undefined;
};

/** In-memory attempts per order. `newKey` is injectable for tests. */
export function createPaymentAttemptStore(newKey: () => string): PaymentAttemptStore {
  const attempts = new Map<string, PendingAttempt>();
  return {
    keyFor: (orderId, scenario) => {
      const pending = attempts.get(orderId);
      if (pending?.scenario === scenario) return pending.key;
      const attempt = { scenario, key: newKey() };
      attempts.set(orderId, attempt);
      return attempt.key;
    },
    settle: (orderId) => {
      attempts.delete(orderId);
    },
    pending: (orderId) => attempts.get(orderId),
  };
}

/**
 * App-wide store: it outlives the payment screen, so leaving and coming back to retry the same
 * attempt still sends the same key.
 */
export const paymentAttempts = createPaymentAttemptStore(() => createUuidV4());
