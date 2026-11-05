import * as Sentry from "@sentry/node";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { registerEsmHooks } from "./esm-hooks";
import { initObservability } from "./init";
import { captureException } from "./sentry";
import type * as TracingModule from "./tracing";
import { resolveTracesUrl, startTracing } from "./tracing";

// Neither the loader hooks nor the NodeSDK are started for real: both patch the test process.
vi.mock("./esm-hooks", () => ({ registerEsmHooks: vi.fn(() => "registered") }));
vi.mock("./tracing", async (importOriginal) => ({
  ...(await importOriginal<typeof TracingModule>()),
  startTracing: vi.fn(() => ({ shutdown: vi.fn(() => Promise.resolve()) })),
}));

beforeEach(() => {
  vi.mocked(registerEsmHooks).mockClear();
  vi.mocked(startTracing).mockClear();
});

describe("initObservability", () => {
  it("is a no-op without DSN or OTLP endpoint and its shutdown resolves", async () => {
    const observability = initObservability({ serviceName: "svc", environment: "test" });

    expect(Sentry.isInitialized()).toBe(false);
    expect(registerEsmHooks).not.toHaveBeenCalled();
    expect(startTracing).not.toHaveBeenCalled();
    await expect(observability.shutdown()).resolves.toBeUndefined();
    await expect(observability.shutdown()).resolves.toBeUndefined();
  });

  it("registers the ESM loader hooks before starting the SDK when an endpoint is set", async () => {
    const observability = initObservability({
      serviceName: "svc",
      environment: "test",
      otlpEndpoint: "http://localhost:4318",
    });

    expect(registerEsmHooks).toHaveBeenCalledTimes(1);
    expect(startTracing).toHaveBeenCalledWith(
      expect.objectContaining({ serviceName: "svc", otlpEndpoint: "http://localhost:4318" }),
    );
    const [hooksOrder] = vi.mocked(registerEsmHooks).mock.invocationCallOrder;
    const [tracingOrder] = vi.mocked(startTracing).mock.invocationCallOrder;
    expect(hooksOrder).toBeLessThan(tracingOrder ?? 0);
    await expect(observability.shutdown()).resolves.toBeUndefined();
  });

  it("treats blank DSN and endpoint as disabled", async () => {
    const observability = initObservability({
      serviceName: "svc",
      environment: "test",
      sentryDsn: " ",
      otlpEndpoint: "",
    });

    expect(Sentry.isInitialized()).toBe(false);
    expect(registerEsmHooks).not.toHaveBeenCalled();
    await expect(observability.shutdown()).resolves.toBeUndefined();
  });

  it("rejects invalid options", () => {
    expect(() => initObservability({ serviceName: "", environment: "test" })).toThrow(
      /serviceName/,
    );
    expect(() =>
      initObservability({ serviceName: "svc", environment: "test", tracesSampleRate: 2 }),
    ).toThrow(RangeError);
  });
});

describe("captureException", () => {
  it("is safe to call when Sentry is disabled", () => {
    expect(captureException(new Error("boom"), { tags: { route: "/x" } })).toBeUndefined();
  });
});

describe("resolveTracesUrl", () => {
  it("appends /v1/traces to a base endpoint", () => {
    expect(resolveTracesUrl("http://localhost:4318")).toBe("http://localhost:4318/v1/traces");
    expect(resolveTracesUrl("https://otel.example.com/otlp/")).toBe(
      "https://otel.example.com/otlp/v1/traces",
    );
  });

  it("keeps a full traces URL and rejects invalid ones", () => {
    expect(resolveTracesUrl("http://collector:4318/v1/traces")).toBe(
      "http://collector:4318/v1/traces",
    );
    expect(() => resolveTracesUrl("not a url")).toThrow(/Invalid OTLP endpoint/);
    expect(() => resolveTracesUrl("ftp://collector")).toThrow(/http/);
  });
});
