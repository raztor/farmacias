import { describe, expect, it } from "vitest";

import { approvedMessage, REJECTED_MESSAGE, replayedMessage } from "./payments.errors";

describe("replayedMessage (R-PAY-04/05, RNF-09)", () => {
  it("keeps the original message while it still describes the order", () => {
    expect(replayedMessage("approved", { code: "P-000001", status: "payment_validated" })).toBe(
      approvedMessage("P-000001"),
    );
    expect(replayedMessage("rejected", { code: "P-000001", status: "payment_rejected" })).toBe(
      REJECTED_MESSAGE,
    );
    expect(replayedMessage("rejected", { code: "P-000001", status: "pending_payment" })).toBe(
      REJECTED_MESSAGE,
    );
  });

  it.each(["cancelled", "in_preparation", "delivered"] as const)(
    "an approved attempt replayed on a %s order states where the order is now",
    (status) => {
      const message = replayedMessage("approved", { code: "P-000001", status });
      expect(message).toMatch(/^Este pago simulado ya había sido aprobado\. Tu pedido P-000001/);
      expect(message).not.toContain("Pago validado");
      expect(message).not.toContain("pronto comenzará su preparación");
    },
  );

  it.each(["payment_validated", "cancelled"] as const)(
    "a rejected attempt replayed on a %s order does not invite to pay again",
    (status) => {
      const message = replayedMessage("rejected", { code: "P-000001", status });
      expect(message).toMatch(/^Este intento de pago ya había sido rechazado\./);
      expect(message).not.toContain("Puedes intentarlo de nuevo");
    },
  );
});
