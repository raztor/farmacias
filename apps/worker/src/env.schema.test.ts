import { describe, expect, it } from "vitest";

import { parseWorkerEnv } from "./env.schema";

const base = {
  REDIS_URL: "redis://localhost:6379",
  DATABASE_URL: "postgresql://app:app@localhost:5432/app",
  SMTP_URL: "smtp://localhost:1025",
  EMAIL_FROM: "App <no-reply@app.local>",
};

describe("parseWorkerEnv", () => {
  it("applies defaults and treats blank optionals as unset", () => {
    const env = parseWorkerEnv({ ...base, SENTRY_DSN: "", OTEL_EXPORTER_OTLP_ENDPOINT: "" });

    expect(env).toMatchObject({
      NODE_ENV: "development",
      LOG_LEVEL: "info",
      WORKER_CONCURRENCY: 5,
      WORKER_HEALTH_PORT: 4100,
    });
    expect(env.SENTRY_DSN).toBeUndefined();
    expect(env.OTEL_EXPORTER_OTLP_ENDPOINT).toBeUndefined();
  });

  it("coerces numeric variables", () => {
    const env = parseWorkerEnv({ ...base, WORKER_CONCURRENCY: "12", WORKER_HEALTH_PORT: "4200" });

    expect(env.WORKER_CONCURRENCY).toBe(12);
    expect(env.WORKER_HEALTH_PORT).toBe(4200);
  });

  it("lists every invalid variable", () => {
    expect(() =>
      parseWorkerEnv({
        ...base,
        REDIS_URL: "http://x",
        SMTP_URL: undefined,
        WORKER_CONCURRENCY: "0",
      }),
    ).toThrow(
      /REDIS_URL[\s\S]*SMTP_URL[\s\S]*WORKER_CONCURRENCY|REDIS_URL[\s\S]*WORKER_CONCURRENCY[\s\S]*SMTP_URL/,
    );
  });
});
