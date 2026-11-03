import type { AppLogger } from "@repo/shared";

/** The part of a BullMQ `Worker` needed to shut it down. */
export type ClosableWorker = {
  readonly name: string;
  close: (force?: boolean) => Promise<void>;
};

export type CloseWorkersOptions = {
  workers: readonly ClosableWorker[];
  /** Max time to wait for in-flight jobs before force-closing (jobs then stall and are retried). */
  drainTimeoutMs: number;
  logger: AppLogger;
};

const DRAIN_TIMED_OUT = Symbol("drain-timed-out");

const drainOrTimeout = async (
  worker: ClosableWorker,
  timeoutMs: number,
): Promise<typeof DRAIN_TIMED_OUT | undefined> => {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<typeof DRAIN_TIMED_OUT>((resolve) => {
    timer = setTimeout(() => {
      resolve(DRAIN_TIMED_OUT);
    }, timeoutMs);
  });
  try {
    return await Promise.race([worker.close().then(() => undefined), timeout]);
  } finally {
    clearTimeout(timer);
  }
};

const closeOne = async (worker: ClosableWorker, options: CloseWorkersOptions): Promise<void> => {
  const outcome = await drainOrTimeout(worker, options.drainTimeoutMs);
  if (outcome !== DRAIN_TIMED_OUT) return;

  options.logger.warn(
    { queue: worker.name, drainTimeoutMs: options.drainTimeoutMs },
    "Worker did not drain in time; force-closing",
  );
  // Not awaited: with Redis unreachable even a forced close can hang.
  worker.close(true).catch((error: unknown) => {
    options.logger.error({ err: error, queue: worker.name }, "Force-closing the worker failed");
  });
  throw new Error(
    `Worker "${worker.name}" did not drain within ${String(options.drainTimeoutMs)}ms`,
  );
};

/**
 * Stops every worker from fetching new jobs and waits for in-flight jobs to finish. Workers that
 * do not drain in time are force-closed. Rejects if any worker failed to close cleanly.
 */
export const closeWorkers = async (options: CloseWorkersOptions): Promise<void> => {
  const results = await Promise.allSettled(
    options.workers.map((worker) => closeOne(worker, options)),
  );
  const errors = results.flatMap((result) =>
    result.status === "rejected" ? [result.reason as unknown] : [],
  );
  if (errors.length > 0) throw new AggregateError(errors, "Failed to close workers cleanly");
};
