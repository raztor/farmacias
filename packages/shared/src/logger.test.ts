import { describe, expect, it } from "vitest";

import { noopLogger, type AppLogger } from "./logger";

describe("noopLogger", () => {
  it("accepts every log call and returns itself as child", () => {
    const logger: AppLogger = noopLogger.child({ module: "test" });
    expect(logger).toBe(noopLogger);
    expect(() => {
      logger.debug({ a: 1 });
      logger.info({}, "message");
      logger.warn({ err: new Error("x") }, "warning");
      logger.error({});
    }).not.toThrow();
  });

  it("is structurally compatible with a pino-like logger", () => {
    const calls: string[] = [];
    const makeLogger = (prefix: string): AppLogger => ({
      debug: (_obj, msg) => calls.push(`${prefix}debug:${msg ?? ""}`),
      info: (_obj, msg) => calls.push(`${prefix}info:${msg ?? ""}`),
      warn: (_obj, msg) => calls.push(`${prefix}warn:${msg ?? ""}`),
      error: (_obj, msg) => calls.push(`${prefix}error:${msg ?? ""}`),
      child: () => makeLogger(`${prefix}child.`),
    });

    makeLogger("").child({ requestId: "1" }).info({}, "hello");
    expect(calls).toEqual(["child.info:hello"]);
  });
});
