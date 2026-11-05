import { noopLogger } from "@repo/shared";
import { describe, expect, it, vi } from "vitest";

import { closeWorkers, type ClosableWorker } from "./close-workers";

const fakeWorker = (name: string, drains: boolean) => {
  const close = vi.fn((force?: boolean) =>
    force === true || drains ? Promise.resolve() : new Promise<void>(() => undefined),
  );
  return { worker: { name, close } satisfies ClosableWorker, close };
};

describe("closeWorkers", () => {
  it("waits for every worker to drain gracefully", async () => {
    const a = fakeWorker("email", true);
    const b = fakeWorker("other", true);

    await closeWorkers({ workers: [a.worker, b.worker], drainTimeoutMs: 1000, logger: noopLogger });

    expect(a.close).toHaveBeenCalledExactlyOnceWith();
    expect(b.close).toHaveBeenCalledExactlyOnceWith();
  });

  it("force-closes a worker that does not drain in time and reports it", async () => {
    const stuck = fakeWorker("email", false);
    const healthy = fakeWorker("other", true);

    await expect(
      closeWorkers({
        workers: [stuck.worker, healthy.worker],
        drainTimeoutMs: 20,
        logger: noopLogger,
      }),
    ).rejects.toThrow(AggregateError);

    expect(stuck.close).toHaveBeenNthCalledWith(1);
    expect(stuck.close).toHaveBeenNthCalledWith(2, true);
    expect(healthy.close).toHaveBeenCalledOnce();
  });
});
