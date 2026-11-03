import { noopLogger, type AppLogger } from "@repo/shared";
import { Worker } from "bullmq";
import { z } from "zod";

import { describeConnection, parseRedisUrl } from "../connection/redis-url";
import { isQueueName, type QueueName } from "../queue-names";
import { createJobProcessor, type JobHandler } from "./job-processor";
import { attachWorkerLogging } from "./worker-logging";

const DEFAULT_CONCURRENCY = 5;

const concurrencySchema = z.number().int().min(1).max(1000);

export type QueueWorker = Worker<unknown, void>;

export type CreateWorkerOptions<Q extends QueueName> = {
  queue: Q;
  /** `redis[s]://[[user][:password]@]host[:port][/db]` */
  redisUrl: string;
  /** Jobs processed in parallel by this worker (default 5). */
  concurrency?: number;
  logger?: AppLogger;
  /** Redis key prefix; must match the producer's (BullMQ default: `bull`). */
  prefix?: string;
  /** Receives the validated payload. */
  process: JobHandler<Q>;
};

/**
 * Starts a BullMQ worker that validates each payload before handing it to `process`.
 * Call `worker.close()` on shutdown to let in-flight jobs finish.
 */
export const createWorker = <Q extends QueueName>(options: CreateWorkerOptions<Q>): QueueWorker => {
  if (!isQueueName(options.queue)) {
    throw new RangeError(`Unknown queue "${String(options.queue)}"`);
  }
  const concurrency = options.concurrency ?? DEFAULT_CONCURRENCY;
  const validConcurrency = concurrencySchema.safeParse(concurrency);
  if (!validConcurrency.success) {
    throw new RangeError(`Invalid worker concurrency: ${String(concurrency)}`);
  }

  const connection = parseRedisUrl(options.redisUrl, "worker");
  const logger = (options.logger ?? noopLogger).child({
    module: "queue-worker",
    queue: options.queue,
  });
  const processor = createJobProcessor({
    queue: options.queue,
    handler: options.process,
    logger,
  });

  const worker: QueueWorker = new Worker(options.queue, processor, {
    connection,
    concurrency: validConcurrency.data,
    ...(options.prefix === undefined ? {} : { prefix: options.prefix }),
  });
  attachWorkerLogging(worker, logger);

  logger.info(
    { redis: describeConnection(connection), concurrency: validConcurrency.data },
    "Worker started",
  );
  return worker;
};
