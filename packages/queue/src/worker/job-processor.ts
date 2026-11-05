import type { AppLogger } from "@repo/shared";
import { UnrecoverableError, type Job, type Processor } from "bullmq";

import { parseJobPayload, summarizeIssues, type JobPayload } from "../jobs/job-registry";
import type { QueueName } from "../queue-names";

export type QueueJob = Job<unknown, void>;

export type JobContext = {
  /** Raw BullMQ job (its `data` is the unvalidated payload; use the `payload` argument). */
  job: QueueJob;
  /** Logger bound to the queue, job id, name and attempt. */
  logger: AppLogger;
  /** Aborted when the worker is force-closed; forward it to cancellable I/O. */
  signal: AbortSignal | undefined;
};

/** Business logic for one job. Throw to fail the attempt (it is retried with backoff). */
export type JobHandler<Q extends QueueName> = (
  payload: JobPayload<Q>,
  context: JobContext,
) => Promise<void>;

type JobProcessorOptions<Q extends QueueName> = {
  queue: Q;
  handler: JobHandler<Q>;
  logger: AppLogger;
};

/**
 * Wraps a handler so every payload is validated before it runs. An invalid payload
 * will never become valid by retrying, so it fails with `UnrecoverableError`.
 */
export const createJobProcessor =
  <Q extends QueueName>({
    queue,
    handler,
    logger,
  }: JobProcessorOptions<Q>): Processor<unknown, void> =>
  async (job, _token, signal) => {
    const jobLogger = logger.child({
      jobId: job.id,
      jobName: job.name,
      attempt: job.attemptsMade + 1,
    });
    const parsed = parseJobPayload(queue, job.data);
    if (!parsed.success) {
      jobLogger.error(
        { issues: summarizeIssues(parsed.error) },
        "Invalid job payload; failing without retry",
      );
      throw new UnrecoverableError(`Invalid job payload for queue "${queue}"`);
    }
    await handler(parsed.data, { job, logger: jobLogger, signal });
  };
