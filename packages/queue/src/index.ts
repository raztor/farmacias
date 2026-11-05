export { UnrecoverableError } from "bullmq";

export { DEFAULT_JOB_OPTIONS, resolveJobOptions, type EnqueueOptions } from "./client/job-options";
export {
  createQueueClient,
  type EnqueuedJob,
  type QueueClient,
  type QueueClientOptions,
} from "./client/queue-client";
export {
  describeConnection,
  parseRedisUrl,
  type ConnectionRole,
  type RedisConnectionOptions,
} from "./connection/redis-url";
export {
  emailJobSchema,
  welcomeEmailJobSchema,
  type EmailJob,
  type EmailJobInput,
  type WelcomeEmailJob,
} from "./jobs/email.job";
export {
  JOB_SCHEMAS,
  parseJobPayload,
  type JobInput,
  type JobPayload,
  type JobSchemas,
} from "./jobs/job-registry";
export { TimeoutError } from "./lib/with-timeout";
export { QUEUE_NAMES, QUEUE_NAME_VALUES, isQueueName, type QueueName } from "./queue-names";
export { createWorker, type CreateWorkerOptions, type QueueWorker } from "./worker/create-worker";
export { type JobContext, type JobHandler, type QueueJob } from "./worker/job-processor";
export { isFinalFailure } from "./worker/worker-logging";
