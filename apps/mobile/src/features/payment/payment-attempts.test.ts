import { describe, expect, it } from "vitest";

import { createPaymentAttemptStore } from "./payment-attempts";

function storeWithCounter() {
  let next = 0;
  return createPaymentAttemptStore(() => {
    next += 1;
    return `key-${String(next)}`;
  });
}

describe("payment attempts (idempotency keys, HU-05 #3)", () => {
  it("creates one key per attempt", () => {
    const store = storeWithCounter();

    expect(store.keyFor("order-1", "approve")).toBe("key-1");
    expect(store.pending("order-1")).toEqual({ scenario: "approve", key: "key-1" });
  });

  it("reuses the key when the same attempt is retried before a definitive answer", () => {
    const store = storeWithCounter();
    const first = store.keyFor("order-1", "approve");

    expect(store.keyFor("order-1", "approve")).toBe(first);
    expect(store.keyFor("order-1", "approve")).toBe(first);
  });

  it("uses a new key once the attempt has a definitive answer", () => {
    const store = storeWithCounter();
    const first = store.keyFor("order-1", "reject");
    store.settle("order-1");

    expect(store.pending("order-1")).toBeUndefined();
    expect(store.keyFor("order-1", "reject")).not.toBe(first);
  });

  it("starts a new attempt when the resident chooses another scenario", () => {
    const store = storeWithCounter();
    const approve = store.keyFor("order-1", "approve");
    const reject = store.keyFor("order-1", "reject");

    expect(reject).not.toBe(approve);
    expect(store.pending("order-1")).toEqual({ scenario: "reject", key: reject });
  });

  it("keeps the attempts of different orders apart", () => {
    const store = storeWithCounter();
    const one = store.keyFor("order-1", "approve");
    const two = store.keyFor("order-2", "approve");
    store.settle("order-2");

    expect(two).not.toBe(one);
    expect(store.keyFor("order-1", "approve")).toBe(one);
  });
});
