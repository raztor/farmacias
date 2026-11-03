import { AppError, noopLogger, type AppLogger } from "@repo/shared";

import { describeConnection, parseRedisUrl } from "../connection/redis-url";
import { parseJobPayload, summarizeIssues, type JobInput } from "../jobs/job-registry";
import { withTimeout } from "../lib/with-timeout";
import { QUEUE_NAMES, isQueueName, type QueueName } from "../queue-names";
import { resolveJobOptions, type EnqueueOptions } from "./job-options";
import { createQueueRegistry } from "./queue-registry";

const DEFAULT_TIMEOUT_MS = 5000;

export type QueueClientOptions = {
  /** `redis[s]://[[user][:password]@]host[:port][/db]` */
  redisUrl: string;
  logger?: AppLogger;
  /** Max time to wait for Redis on `enqueue` and `ping` (default 5000 ms). */
  timeoutMs?: number;
  /** Redis key prefix shared by producers and workers (BullMQ default: `bull`). */
  prefix?: string;
};

export type EnqueuedJob = {
  id: string;
  queue: QueueName;
  /** Job name in BullMQ: the payload's `type`. */
  name: string;
};

export type QueueClient = {
  /** Validates `payload` with the queue's zod schema and adds it with retry defaults. */
  enqueue: <Q extends QueueName>(
    queue: Q,
    payload: JobInput<Q>,
    opts?: EnqueueOptions,
  ) => Promise<EnqueuedJob>;
  /** Resolves `true` when Redis answers within the timeout. Never rejects. */
  ping: () => Promise<boolean>;
  /** Closes every Redis connection opened by this client. */
  close: () => Promise<void>;
};

/**
 * Producer side of the queues. Creating the client does not touch Redis: each queue
 * (and its connection) is created on first `enqueue`/`ping`.
 */
export const createQueueClient = (options: QueueClientOptions): QueueClient => {
  const connection = parseRedisUrl(options.redisUrl, "producer");
  const logger = (options.logger ?? noopLogger).child({ module: "queue-client" });
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const registry = createQueueRegistry({ connection, logger, prefix: options.prefix });
  let closed = false;

  logger.debug({ redis: describeConnection(connection) }, "Queue client created");

  const enqueue: QueueClient["enqueue"] = async (queue, payload, opts) => {
    if (closed) throw new AppError("INTERNAL", "Queue client is closed");
    if (!isQueueName(queue)) throw new AppError("INTERNAL", `Unknown queue "${String(queue)}"`);

    const parsed = parseJobPayload(queue, payload);
    if (!parsed.success) {
      logger.error(
        { queue, issues: summarizeIssues(parsed.error) },
        "Rejected invalid job payload",
      );
      throw new AppError("INTERNAL", `Invalid job payload for queue "${queue}"`, {
        cause: parsed.error,
      });
    }

    const name = parsed.data.type;
    const job = await withTimeout(
      registry.get(queue).add(name, parsed.data, resolveJobOptions(opts)),
      timeoutMs,
      `Timed out enqueuing a job on queue "${queue}"`,
    ).catch((error: unknown) => {
      logger.error({ err: error, queue, jobName: name }, "Failed to enqueue job");
      throw new AppError("INTERNAL", `Failed to enqueue job on queue "${queue}"`, { cause: error });
    });

    if (job.id === undefined) {
      throw new AppError("INTERNAL", `Queue "${queue}" did not assign a job id`);
    }
    logger.info({ queue, jobId: job.id, jobName: name }, "Job enqueued");
    return { id: job.id, queue, name };
  };

  const ping = async (): Promise<boolean> => {
    if (closed) return false;
    try {
      const backend = registry.get(QUEUE_NAMES.email).getBackend();
      await withTimeout(
        backend.client.then((client) => client.info()),
        timeoutMs,
        "Timed out pinging Redis",
      );
      return true;
    } catch (error) {
      logger.warn({ err: error }, "Redis ping failed");
      return false;
    }
  };

  const close = async (): Promise<void> => {
    closed = true;
    await registry.closeAll();
  };

  return { enqueue, ping, close };
};
