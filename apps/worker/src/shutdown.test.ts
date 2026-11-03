import { noopLogger } from "@repo/shared";
import { describe, expect, it } from "vitest";

import { createGracefulShutdown } from "./shutdown";

describe("createGracefulShutdown", () => {
  it("runs every step in order once, even when called repeatedly", async () => {
    const calls: string[] = [];
    const shutdown = createGracefulShutdown({
      logger: noopLogger,
      steps: [
        { name: "a", run: () => void calls.push("a") },
        { name: "b", run: () => Promise.resolve().then(() => void calls.push("b")) },
      ],
    });

    const [first, second] = await Promise.all([shutdown("SIGTERM"), shutdown("SIGINT")]);

    expect(first).toBe(true);
    expect(second).toBe(true);
    expect(calls).toEqual(["a", "b"]);
  });

  it("keeps going after a failing step and reports failure", async () => {
    const calls: string[] = [];
    const shutdown = createGracefulShutdown({
      logger: noopLogger,
      steps: [
        { name: "boom", run: () => Promise.reject(new Error("boom")) },
        { name: "after", run: () => void calls.push("after") },
      ],
    });

    await expect(shutdown("SIGTERM")).resolves.toBe(false);
    expect(calls).toEqual(["after"]);
  });
});
