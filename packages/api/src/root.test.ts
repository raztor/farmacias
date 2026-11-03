import { describe, expect, it } from "vitest";

import { createCaller } from "./root";
import { createRecordingLogger, createTestContext } from "./testing/fakes";

describe("appRouter", () => {
  it("answers health.ping without a session", async () => {
    const { logger, entries } = createRecordingLogger();
    const caller = createCaller(await createTestContext({ logger }));

    const result = await caller.health.ping();

    expect(result.status).toBe("ok");
    expect(Number.isNaN(Date.parse(result.time))).toBe(false);
    const logged = entries.find((entry) => entry.level === "info");
    expect(logged?.obj).toMatchObject({
      path: "health.ping",
      type: "query",
      requestId: "test-request",
    });
    expect(logged?.obj).toHaveProperty("durationMs", expect.any(Number));
  });

  it("logs rejected calls as warnings", async () => {
    const { logger, entries } = createRecordingLogger();
    const caller = createCaller(await createTestContext({ logger }));

    await expect(caller.user.me()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    const logged = entries.find((entry) => entry.level === "warn");
    expect(logged?.obj).toMatchObject({ path: "user.me", code: "UNAUTHORIZED" });
  });
});
