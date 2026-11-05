import { randomBytes } from "node:crypto";

import type { PaymentGateway } from "./payment-gateway";

export type SimulatedPaymentGatewayOptions = {
  /** Synthetic reference generator (injectable for deterministic tests). */
  generateReference?: () => string;
};

const randomReference = (): string => `SIM-${randomBytes(6).toString("hex").toUpperCase()}`;

/**
 * Adapter of the `PaymentGateway` port used by the MVP (RF-06, RNF-11): no money, no external
 * service. `approve` answers `approved`, `reject` answers `rejected`, always with a synthetic
 * `SIM-…` reference.
 */
export const createSimulatedPaymentGateway = ({
  generateReference = randomReference,
}: SimulatedPaymentGatewayOptions = {}): PaymentGateway => ({
  charge: ({ scenario }) =>
    Promise.resolve({
      outcome: scenario === "approve" ? "approved" : "rejected",
      reference: generateReference(),
    }),
});
