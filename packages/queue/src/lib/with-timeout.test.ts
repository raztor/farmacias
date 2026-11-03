import { afterEach, describe, expect, it, vi } from "vitest";

import { TimeoutError, withTimeout } from "./with-timeout";

describe("withTimeout", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves with the value when the promise settles in time", async () => {
    await expect(withTimeout(Promise.resolve("ok"), 100, "slow")).resolves.toBe("ok");
  });

  it("propagates the original rejection", async () => {
    const error = new Error("boom");
    await expect(withTimeout(Promise.reject(error), 100, "slow")).rejects.toBe(error);
  });

  it("rejects with TimeoutError when the budget is exceeded", async () => {
    vi.useFakeTimers();
    const pending = withTimeout(new Promise<never>(() => undefined), 50, "too slow");
    const assertion = expect(pending).rejects.toThrow(TimeoutError);
    await vi.advanceTimersByTimeAsync(50);
    await assertion;
    expect(vi.getTimerCount()).toBe(0);
  });
});
