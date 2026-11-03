import type { AppLogger } from "@repo/shared";
import type { Worker } from "bullmq";

import type { QueueJob } from "./job-processor";

const isUnrecoverable = (error: Error): boolean => error.name === "UnrecoverableError";

/** True when BullMQ will not retry the job again. */
export const isFinalFailure = (job: QueueJob, error: Error): boolean =>
  isUnrecoverable(error) || job.attemptsMade >= (job.opts.attempts ?? 1);

/** Structured logs for the worker lifecycle. Also prevents unhandled `error` events. */
export const attachWorkerLogging = (worker: Worker<unknown, void>, logger: AppLogger): void => {
  worker.on("failed", (job, error) => {
    if (!job) {
      logger.error({ err: error }, "Job failed after being removed (stalled limit reached)");
      return;
    }
    const context = {
      err: error,
      jobId: job.id,
      jobName: job.name,
      attemptsMade: job.attemptsMade,
      maxAttempts: job.opts.attempts ?? 1,
    };
    if (isFinalFailure(job, error)) {
      logger.error(context, "Job failed permanently");
    } else {
      logger.warn(context, "Job failed; it will be retried");
    }
  });

  worker.on("completed", (job) => {
    logger.info({ jobId: job.id, jobName: job.name }, "Job completed");
  });

  worker.on("error", (error) => {
    logger.error({ err: error }, "Worker error");
  });
};
