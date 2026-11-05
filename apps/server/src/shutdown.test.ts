import { noopLogger } from "@repo/shared";
import { describe, expect, it } from "vitest";

import { createGracefulShutdown } from "./shutdown";

describe("createGracefulShutdown", () => {
  it("runs every step in order, even after a failure", async () => {
    const calls: string[] = [];
    const shutdown = createGracefulShutdown({
      logger: noopLogger,
      steps: [
        { name: "a", run: () => void calls.push("a") },
        {
          name: "b",
          run: () => {
            calls.push("b");
            throw new Error("b failed");
          },
        },
        { name: "c", run: () => Promise.resolve(void calls.push("c")) },
      ],
    });

    await expect(shutdown("SIGTERM")).resolves.toBe(false);
    expect(calls).toEqual(["a", "b", "c"]);
  });

  it("is idempotent", async () => {
    let runs = 0;
    const shutdown = createGracefulShutdown({
      logger: noopLogger,
      steps: [{ name: "once", run: () => void (runs += 1) }],
    });
    const [first, second] = await Promise.all([shutdown("SIGTERM"), shutdown("SIGINT")]);
    expect(first).toBe(true);
    expect(second).toBe(true);
    expect(runs).toBe(1);
  });
});
