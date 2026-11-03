import { Writable } from "node:stream";

import { trace, TraceFlags } from "@opentelemetry/api";
import { describe, expect, it, vi } from "vitest";

import { createLogger } from "./logger";
import { REDACTED } from "./redaction";

const createMemoryDestination = () => {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk: Buffer, _encoding, callback) {
      lines.push(chunk.toString("utf8"));
      callback();
    },
  });
  const records = () => lines.map((line) => JSON.parse(line) as Record<string, unknown>);
  return { stream, records };
};

const logOnce = (payload: Record<string, unknown>) => {
  const { stream, records } = createMemoryDestination();
  const logger = createLogger({
    service: "test-service",
    environment: "test",
    destination: stream,
  });
  logger.info(payload, "message");
  const [record] = records();
  return record!;
};

describe("createLogger", () => {
  it("adds service and env bindings, a level label and ISO time", () => {
    const record = logOnce({ requestId: "r-1" });

    expect(record).toMatchObject({
      service: "test-service",
      env: "test",
      level: "info",
      msg: "message",
      requestId: "r-1",
    });
    expect(typeof record.time).toBe("string");
  });

  it("redacts credential headers on requests and responses", () => {
    const record = logOnce({
      req: { headers: { authorization: "Bearer abc", cookie: "session=1", accept: "*/*" } },
      res: { headers: { "set-cookie": ["session=2"], "content-type": "application/json" } },
    });

    expect(record.req).toEqual({
      headers: { authorization: REDACTED, cookie: REDACTED, accept: "*/*" },
    });
    expect(record.res).toEqual({
      headers: { "set-cookie": REDACTED, "content-type": "application/json" },
    });
  });

  it("redacts secret-like fields at the top level and nested", () => {
    const record = logOnce({
      password: "hunter2",
      token: "t",
      input: { user: { email: "a@b.cl", credentials: { password: "p", secret: "s" } } },
      session: { accessToken: "at", refreshToken: "rt" },
      items: [{ token: "in-array" }],
    });

    expect(record.password).toBe(REDACTED);
    expect(record.token).toBe(REDACTED);
    expect(record.input).toEqual({
      user: { email: "a@b.cl", credentials: { password: REDACTED, secret: REDACTED } },
    });
    expect(record.session).toEqual({ accessToken: REDACTED, refreshToken: REDACTED });
    expect(record.items).toEqual([{ token: REDACTED }]);
  });

  it("redacts fields passed as child bindings", () => {
    const { stream, records } = createMemoryDestination();
    const logger = createLogger({ service: "svc", destination: stream });
    logger.child({ auth: { token: "secret-token" } }).warn("child");

    expect(records()[0]).toMatchObject({ auth: { token: REDACTED }, level: "warn" });
  });

  it("does not mutate the logged object", () => {
    const payload = { user: { password: "keep-me" } };
    logOnce(payload);

    expect(payload.user.password).toBe("keep-me");
  });

  it("respects the configured level", () => {
    const { stream, records } = createMemoryDestination();
    const logger = createLogger({ service: "svc", level: "warn", destination: stream });
    logger.info("hidden");
    logger.error({ code: 1 }, "shown");

    expect(records().map((record) => record.msg)).toEqual(["shown"]);
  });

  it("adds the active OpenTelemetry span and nothing without one", () => {
    expect(logOnce({})).not.toHaveProperty("trace_id");

    const span = trace.wrapSpanContext({
      traceId: "0af7651916cd43dd8448eb211c80319c",
      spanId: "b7ad6b7169203331",
      traceFlags: TraceFlags.SAMPLED,
    });
    const getActiveSpan = vi.spyOn(trace, "getActiveSpan").mockReturnValue(span);

    expect(logOnce({})).toMatchObject({
      trace_id: "0af7651916cd43dd8448eb211c80319c",
      span_id: "b7ad6b7169203331",
      trace_flags: "01",
    });
    getActiveSpan.mockRestore();
  });

  it("rejects an empty service name", () => {
    expect(() => createLogger({ service: "  " })).toThrow(/service/);
  });
});
