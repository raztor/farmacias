import { noopLogger } from "@repo/shared";
import { UnrecoverableError } from "bullmq";
import { describe, expect, it, vi } from "vitest";

import { createJobProcessor, type JobHandler, type QueueJob } from "./job-processor";

const fakeJob = (data: unknown): QueueJob =>
  ({ id: "1", name: "welcome", data, attemptsMade: 0, opts: {} }) as unknown as QueueJob;

describe("createJobProcessor", () => {
  it("passes the validated payload to the handler", async () => {
    const handler = vi.fn<JobHandler<"email">>(() => Promise.resolve());
    const processor = createJobProcessor({ queue: "email", handler, logger: noopLogger });
    const job = fakeJob({ type: "welcome", to: "ANA@example.cl", name: "Ana" });
    const signal = new AbortController().signal;

    await processor(job, "token", signal);

    expect(handler).toHaveBeenCalledWith(
      { type: "welcome", to: "ana@example.cl", name: "Ana" },
      { job, logger: noopLogger, signal },
    );
  });

  it("fails invalid payloads with UnrecoverableError so they are not retried", async () => {
    const handler = vi.fn<JobHandler<"email">>(() => Promise.resolve());
    const error = vi.fn();
    const logger = { ...noopLogger, error, child: () => ({ ...noopLogger, error }) };
    const processor = createJobProcessor({ queue: "email", handler, logger });

    await expect(processor(fakeJob({ type: "welcome" }))).rejects.toBeInstanceOf(
      UnrecoverableError,
    );
    expect(handler).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith(
      { issues: expect.arrayContaining([expect.objectContaining({ path: "to" })]) as unknown },
      "Invalid job payload; failing without retry",
    );
  });

  it("propagates handler errors so BullMQ retries the job", async () => {
    const failure = new Error("SMTP unavailable");
    const handler = vi.fn<JobHandler<"email">>(() => Promise.reject(failure));
    const processor = createJobProcessor({ queue: "email", handler, logger: noopLogger });

    await expect(processor(fakeJob({ type: "welcome", to: "a@b.cl", name: "A" }))).rejects.toBe(
      failure,
    );
  });
});
