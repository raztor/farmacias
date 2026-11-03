import { describe, expect, it } from "vitest";

import { parseObservabilityEnv, parseServerEnv } from "./env.schema";

const VALID = {
  DATABASE_URL: "postgresql://app:app@localhost:5432/app",
  REDIS_URL: "redis://localhost:6379",
  BETTER_AUTH_SECRET: "x".repeat(32),
  BETTER_AUTH_URL: "http://localhost:4000",
  TRUSTED_ORIGINS: "http://localhost:8081, http://localhost:3001,bnp://",
};

describe("parseServerEnv", () => {
  it("applies defaults and parses lists", () => {
    const env = parseServerEnv(VALID);
    expect(env).toMatchObject({
      NODE_ENV: "development",
      LOG_LEVEL: "info",
      HOST: "0.0.0.0",
      PORT: 4000,
      RATE_LIMIT_MAX: 300,
      TRUST_PROXY_HOPS: 1,
      TRUSTED_ORIGINS: ["http://localhost:8081", "http://localhost:3001", "bnp://"],
    });
    expect(env.SENTRY_DSN).toBeUndefined();
  });

  it("treats empty optional variables as unset", () => {
    const env = parseServerEnv({ ...VALID, SENTRY_DSN: "", OTEL_EXPORTER_OTLP_ENDPOINT: "" });
    expect(env.SENTRY_DSN).toBeUndefined();
    expect(env.OTEL_EXPORTER_OTLP_ENDPOINT).toBeUndefined();
  });

  it("reports every invalid variable", () => {
    expect(() =>
      parseServerEnv({
        ...VALID,
        BETTER_AUTH_SECRET: "change-me",
        DATABASE_URL: "mysql://localhost/app",
        PORT: "99999",
        TRUSTED_ORIGINS: " , ",
      }),
    ).toThrow(/BETTER_AUTH_SECRET[\s\S]*DATABASE_URL|DATABASE_URL[\s\S]*BETTER_AUTH_SECRET/);
  });

  it("coerces numbers", () => {
    expect(parseServerEnv({ ...VALID, PORT: "8080", RATE_LIMIT_MAX: "50" })).toMatchObject({
      PORT: 8080,
      RATE_LIMIT_MAX: 50,
    });
  });
});

describe("parseObservabilityEnv", () => {
  it("only needs the observability variables", () => {
    expect(parseObservabilityEnv({ NODE_ENV: "production" })).toEqual({ NODE_ENV: "production" });
  });

  it("rejects a non-http OTLP endpoint", () => {
    expect(() => parseObservabilityEnv({ OTEL_EXPORTER_OTLP_ENDPOINT: "grpc://x:4317" })).toThrow(
      /OTEL_EXPORTER_OTLP_ENDPOINT/,
    );
  });
});
