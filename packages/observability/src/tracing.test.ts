import { FastifyOtelInstrumentation } from "@fastify/otel";
import { afterEach, describe, expect, it, vi } from "vitest";

import { buildSdkConfiguration, resolveOtelSignals } from "./tracing";

const OPTIONS = {
  serviceName: "svc",
  serviceVersion: "1.2.3",
  environment: "test",
  otlpEndpoint: "http://localhost:4318",
};

type SdkConfiguration = ReturnType<typeof buildSdkConfiguration>;

/** Instrumentations enable themselves (patching this process) when built: undo it after each test. */
const built: SdkConfiguration[] = [];

const build = (signals: Parameters<typeof buildSdkConfiguration>[1]): SdkConfiguration => {
  const config = buildSdkConfiguration(OPTIONS, signals);
  built.push(config);
  return config;
};

const instrumentationsOf = (config: SdkConfiguration) => (config.instrumentations ?? []).flat();

afterEach(() => {
  vi.unstubAllEnvs();
  for (const instrumentation of built.splice(0).flatMap(instrumentationsOf)) {
    instrumentation.disable();
  }
});

describe("resolveOtelSignals", () => {
  it("keeps metrics and logs off unless their exporter variable is set", () => {
    vi.stubEnv("OTEL_METRICS_EXPORTER", "");
    vi.stubEnv("OTEL_LOGS_EXPORTER", " ");
    expect(resolveOtelSignals()).toEqual({ metrics: false, logs: false });

    vi.stubEnv("OTEL_METRICS_EXPORTER", "otlp");
    vi.stubEnv("OTEL_LOGS_EXPORTER", "console");
    expect(resolveOtelSignals()).toEqual({ metrics: true, logs: true });
  });
});

describe("buildSdkConfiguration", () => {
  it("turns metrics and logs off with empty reader and processor lists", () => {
    const config = build({ metrics: false, logs: false });

    expect(config.metricReaders).toEqual([]);
    expect(config.logRecordProcessors).toEqual([]);
    expect(config.traceExporter).toBeDefined();
    expect(config.resource?.attributes).toMatchObject({
      "service.name": "svc",
      "service.version": "1.2.3",
      "deployment.environment.name": "test",
    });
  });

  it("leaves metrics and logs to the SDK's OTEL_* configuration when enabled", () => {
    const config = build({ metrics: true, logs: true });

    expect(config).not.toHaveProperty("metricReaders");
    expect(config).not.toHaveProperty("logRecordProcessors");
  });

  it("adds the official Fastify instrumentation next to the auto-instrumentations", () => {
    const config = build({ metrics: false, logs: false });
    const names = instrumentationsOf(config).map((item) => item.instrumentationName);

    expect(names).toContain("@opentelemetry/instrumentation-http");
    expect(names).toContain("@fastify/otel");
    expect(names).not.toContain("@opentelemetry/instrumentation-fs");
    expect(instrumentationsOf(config)).toContainEqual(expect.any(FastifyOtelInstrumentation));
  });
});
