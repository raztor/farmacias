/** Every BullMQ queue used by the platform. The value is the Redis queue name. */
export const QUEUE_NAMES = {
  email: "email",
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

export const QUEUE_NAME_VALUES = Object.values(QUEUE_NAMES) as readonly QueueName[];

export const isQueueName = (value: unknown): value is QueueName =>
  typeof value === "string" && (QUEUE_NAME_VALUES as readonly string[]).includes(value);
