import type { OnUserCreated } from "@repo/auth";
import { QUEUE_NAMES, type QueueClient } from "@repo/queue";

/**
 * Better Auth `onUserCreated` hook: enqueues the welcome email for the worker. Failures are
 * logged by `@repo/auth` and never fail the sign-up (the user already exists at this point).
 */
export const createWelcomeEmailHook =
  (queue: Pick<QueueClient, "enqueue">): OnUserCreated =>
  async (user) => {
    await queue.enqueue(QUEUE_NAMES.email, { type: "welcome", to: user.email, name: user.name });
  };
