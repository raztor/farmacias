import { QUEUE_NAMES, type QueueClient } from "@repo/queue";
import { describe, expect, it, vi } from "vitest";

import { createWelcomeEmailHook } from "./welcome-email";

describe("createWelcomeEmailHook", () => {
  it("enqueues the welcome email for the new user", async () => {
    const enqueue = vi.fn<QueueClient["enqueue"]>().mockResolvedValue({
      id: "1",
      queue: QUEUE_NAMES.email,
      name: "welcome",
    });
    const hook = createWelcomeEmailHook({ enqueue });

    await hook({ id: "u1", email: "ana@example.com", name: "Ana" });

    expect(enqueue).toHaveBeenCalledWith(QUEUE_NAMES.email, {
      type: "welcome",
      to: "ana@example.com",
      name: "Ana",
    });
  });

  it("propagates enqueue failures so @repo/auth can log them", async () => {
    const enqueue = vi.fn<QueueClient["enqueue"]>().mockRejectedValue(new Error("redis down"));
    const hook = createWelcomeEmailHook({ enqueue });
    await expect(hook({ id: "u1", email: "ana@example.com", name: "Ana" })).rejects.toThrow(
      "redis down",
    );
  });
});
