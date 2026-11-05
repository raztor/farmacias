import { describe, expect, it } from "vitest";

import { TimeoutError, withTimeout } from "./with-timeout";

describe("withTimeout", () => {
  it("resolves with the operation result", async () => {
    await expect(withTimeout(Promise.resolve(42), 50, "late")).resolves.toBe(42);
  });

  it("rejects with TimeoutError when the operation is too slow", async () => {
    const slow = new Promise((resolve) => setTimeout(resolve, 200));
    await expect(withTimeout(slow, 10, "too slow")).rejects.toBeInstanceOf(TimeoutError);
  });

  it("propagates the operation error", async () => {
    await expect(withTimeout(Promise.reject(new Error("boom")), 50, "late")).rejects.toThrow(
      "boom",
    );
  });
});
