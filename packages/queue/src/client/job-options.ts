import type { JobsOptions } from "bullmq";

const SECOND = 1;
const HOUR = 3600 * SECOND;
const DAY = 24 * HOUR;

/**
 * Defaults applied to every enqueued job (callers may override per job):
 * 5 attempts with exponential backoff starting at 2s (2s, 4s, 8s, 16s), and bounded
 * retention so Redis memory does not grow forever. Failed jobs are kept longer for debugging.
 */
export const DEFAULT_JOB_OPTIONS = {
  attempts: 5,
  backoff: { type: "exponential", delay: 2000 },
  removeOnComplete: { age: DAY, count: 1000 },
  removeOnFail: { age: 7 * DAY, count: 5000 },
} as const satisfies JobsOptions;

/** Per-job overrides accepted by `enqueue`. */
export type EnqueueOptions = Pick<
  JobsOptions,
  | "attempts"
  | "backoff"
  | "delay"
  | "deduplication"
  | "jobId"
  | "priority"
  | "removeOnComplete"
  | "removeOnFail"
>;

export const resolveJobOptions = (overrides: EnqueueOptions = {}): JobsOptions => ({
  ...DEFAULT_JOB_OPTIONS,
  backoff: { ...DEFAULT_JOB_OPTIONS.backoff },
  removeOnComplete: { ...DEFAULT_JOB_OPTIONS.removeOnComplete },
  removeOnFail: { ...DEFAULT_JOB_OPTIONS.removeOnFail },
  ...overrides,
});
