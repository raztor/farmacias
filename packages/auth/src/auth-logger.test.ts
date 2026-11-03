import { type AppLogger, noopLogger } from "@repo/shared";
import { describe, expect, it, vi } from "vitest";

import { toBetterAuthLogger } from "./auth-logger";

function createSpyLogger() {
  const warn = vi.fn();
  const error = vi.fn();
  const child = vi.fn();
  const logger: AppLogger = { ...noopLogger, warn, error, child };
  child.mockReturnValue(logger);
  return { logger, warn, error, child };
}

describe("toBetterAuthLogger", () => {
  it("logs less in production", () => {
    const { logger } = createSpyLogger();

    expect(toBetterAuthLogger(logger, true).level).toBe("warn");
    expect(toBetterAuthLogger(logger, false).level).toBe("info");
  });

  it("forwards entries to a child logger scoped to the auth module", () => {
    const { logger, warn, child } = createSpyLogger();

    toBetterAuthLogger(logger, false).log("warn", "slow query");

    expect(child).toHaveBeenCalledWith({ module: "auth" });
    expect(warn).toHaveBeenCalledWith({}, "slow query");
  });

  it("serializes errors under `err` and keeps extra arguments", () => {
    const { logger, error } = createSpyLogger();
    const failure = new Error("boom");

    toBetterAuthLogger(logger, false).log("error", "request failed", { path: "/x" }, failure);

    expect(error).toHaveBeenCalledWith({ err: failure, args: [{ path: "/x" }] }, "request failed");
  });
});
