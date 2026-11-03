import { z } from "zod";

import { QUEUE_NAMES, type QueueName } from "../queue-names";
import { emailJobSchema } from "./email.job";

/**
 * Every job payload carries a `type` discriminator. It doubles as the BullMQ job
 * name, which keeps dashboards and logs readable without inspecting the payload.
 */
type JobPayloadSchema = z.ZodType<{ type: string }>;

/** Single source of truth: queue name -> zod schema of its job payload. */
export const JOB_SCHEMAS = {
  [QUEUE_NAMES.email]: emailJobSchema,
} as const satisfies Record<QueueName, JobPayloadSchema>;

export type JobSchemas = typeof JOB_SCHEMAS;

/** Validated payload, as stored in Redis and received by workers. */
export type JobPayload<Q extends QueueName> = z.output<JobSchemas[Q]>;

/** Payload accepted by `enqueue` (before zod normalization). */
export type JobInput<Q extends QueueName> = z.input<JobSchemas[Q]>;

/** Validates an untrusted payload against the schema registered for `queue`. */
export const parseJobPayload = <Q extends QueueName>(
  queue: Q,
  data: unknown,
): z.ZodSafeParseResult<JobPayload<Q>> => z.safeParse(JOB_SCHEMAS[queue], data);

/** Issue summary safe for logs: paths and messages only, never the offending values. */
export const summarizeIssues = (error: z.ZodError): { path: string; message: string }[] =>
  error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message }));
