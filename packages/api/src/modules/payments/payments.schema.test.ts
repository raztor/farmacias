import { describe, expect, it } from "vitest";

import { payInput } from "./payments.schema";

const valid = {
  orderId: "order-1",
  idempotencyKey: "0b8f6c1e-6a52-4f7e-9d43-2f1c8a7e5b10",
  scenario: "approve",
} as const;

describe("payInput", () => {
  it("accepts an order, a UUID idempotency key and a known scenario", () => {
    expect(payInput.parse(valid)).toEqual(valid);
    expect(payInput.parse({ ...valid, scenario: "reject" }).scenario).toBe("reject");
  });

  it("rejects a key that is not a UUID", () => {
    const result = payInput.safeParse({ ...valid, idempotencyKey: "retry-1" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]).toMatchObject({
      path: ["idempotencyKey"],
      message: "La clave del intento de pago no es válida",
    });
  });

  it("rejects an unknown scenario", () => {
    const result = payInput.safeParse({ ...valid, scenario: "random" });
    expect(result.error?.issues[0]).toMatchObject({ path: ["scenario"] });
  });

  it("never takes an amount from the client", () => {
    expect(payInput.parse({ ...valid, amountClp: 1 })).not.toHaveProperty("amountClp");
  });
});
