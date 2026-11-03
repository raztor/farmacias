import type { AppLogger } from "@repo/shared";
import { Queue } from "bullmq";

import type { RedisConnectionOptions } from "../connection/redis-url";
import type { QueueName } from "../queue-names";

export type ProducerQueue = Queue<unknown, unknown>;

export type QueueRegistry = {
  /** Returns the queue, creating it (and its lazy Redis connection) on first use. */
  get: (name: QueueName) => ProducerQueue;
  /** Closes every queue created so far. Never rejects: failures are logged. */
  closeAll: () => Promise<void>;
};

type QueueRegistryOptions = {
  connection: RedisConnectionOptions;
  logger: AppLogger;
  prefix?: string | undefined;
};

export const createQueueRegistry = ({
  connection,
  logger,
  prefix,
}: QueueRegistryOptions): QueueRegistry => {
  const queues = new Map<QueueName, ProducerQueue>();

  const get = (name: QueueName): ProducerQueue => {
    const existing = queues.get(name);
    if (existing) return existing;

    const queue: ProducerQueue = new Queue(name, {
      connection,
      ...(prefix === undefined ? {} : { prefix }),
    });
    // Without an `error` listener, a Redis outage would crash the process.
    queue.on("error", (err) => {
      logger.error({ err, queue: name }, "Queue connection error");
    });
    queues.set(name, queue);
    return queue;
  };

  const closeAll = async (): Promise<void> => {
    const entries = [...queues.entries()];
    queues.clear();
    const results = await Promise.allSettled(entries.map(([, queue]) => queue.close()));
    results.forEach((result, index) => {
      if (result.status === "rejected") {
        const error: unknown = result.reason;
        logger.error({ err: error, queue: entries[index]?.[0] }, "Failed to close queue");
      }
    });
  };

  return { get, closeAll };
};
