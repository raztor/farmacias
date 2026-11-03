import { describe, expect, it } from "vitest";

import { DEFAULT_JOB_OPTIONS, QUEUE_NAMES, UnrecoverableError, createQueueClient } from "./index";

describe("public API", () => {
  it("exposes queue names and defaults without connecting at import time", () => {
    expect(QUEUE_NAMES).toEqual({ email: "email" });
    expect(DEFAULT_JOB_OPTIONS).toMatchObject({
      attempts: 5,
      backoff: { type: "exponential", delay: 2000 },
    });
    expect(new UnrecoverableError("x")).toBeInstanceOf(Error);
    expect(createQueueClient).toBeTypeOf("function");
  });
});
