import { describe, expect, it } from "vitest";

import { createSimulatedPaymentGateway } from "./simulated-payment-gateway";

const request = { orderId: "o1", amountClp: 4980, idempotencyKey: "k1" } as const;

describe("SimulatedPaymentGateway (RF-06, RNF-11)", () => {
  it("approves the 'approve' scenario with a synthetic reference", async () => {
    const result = await createSimulatedPaymentGateway().charge({
      ...request,
      scenario: "approve",
    });
    expect(result.outcome).toBe("approved");
    expect(result.reference).toMatch(/^SIM-[0-9A-F]{12}$/);
  });

  it("rejects the 'reject' scenario", async () => {
    const gateway = createSimulatedPaymentGateway({ generateReference: () => "SIM-TEST" });
    await expect(gateway.charge({ ...request, scenario: "reject" })).resolves.toEqual({
      outcome: "rejected",
      reference: "SIM-TEST",
    });
  });

  it("generates a different reference for each attempt", async () => {
    const gateway = createSimulatedPaymentGateway();
    const [a, b] = await Promise.all([
      gateway.charge({ ...request, scenario: "approve" }),
      gateway.charge({ ...request, scenario: "approve" }),
    ]);
    expect(a.reference).not.toBe(b.reference);
  });
});
