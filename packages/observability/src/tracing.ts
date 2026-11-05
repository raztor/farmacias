import type { IncomingMessage } from "node:http";

import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { NodeSDK, type NodeSDKConfiguration } from "@opentelemetry/sdk-node";
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from "@opentelemetry/semantic-conventions";

import { isOtelVariableSet } from "./env";
import { createFastifyInstrumentation } from "./fastify-otel";
import { IGNORED_INCOMING_PATHS } from "./ignored-paths";

/**
 * `deployment.environment.name` lives in the incubating semconv entry point, which upstream
 * recommends copying instead of importing (it may change between minor versions).
 */
const ATTR_DEPLOYMENT_ENVIRONMENT_NAME = "deployment.environment.name";

const OTLP_TRACES_PATH = "/v1/traces";

export type TracingOptions = {
  serviceName: string;
  serviceVersion?: string;
  environment: string;
  /** Base OTLP/HTTP endpoint (e.g. `http://localhost:4318`) or the full `/v1/traces` URL. */
  otlpEndpoint: string;
};

/** Resolves the traces URL from a base OTLP endpoint, as `OTEL_EXPORTER_OTLP_ENDPOINT` does. */
export function resolveTracesUrl(endpoint: string): string {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch (error) {
    throw new Error(`Invalid OTLP endpoint URL: "${endpoint}"`, { cause: error });
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`OTLP endpoint must use http(s), received "${url.protocol}"`);
  }
  if (url.pathname.endsWith(OTLP_TRACES_PATH)) {
    return url.toString();
  }
  url.pathname = `${url.pathname.replace(/\/+$/, "")}${OTLP_TRACES_PATH}`;
  return url.toString();
}

const isIgnoredIncomingRequest = (request: IncomingMessage): boolean => {
  const path = request.url?.split("?")[0];
  return path !== undefined && IGNORED_INCOMING_PATHS.has(path);
};

/**
 * Which signals besides traces the NodeSDK exports. Upstream defaults both to OTLP
 * (`http/protobuf`, to `/v1/metrics` and `/v1/logs`); here they are opt-in instead:
 * - Metrics: only when `OTEL_METRICS_EXPORTER` is set (`otlp`, `console`, `prometheus`), so a
 *   traces-only collector (Jaeger, Tempo...) does not log a failed export every minute.
 * - Logs: only when `OTEL_LOGS_EXPORTER` is set. pino writes JSON to stdout, which the container
 *   runtime ships, and `createLogger` adds `trace_id`/`span_id` to each record. pino records are
 *   not sent through OTLP even then: pino loads before the SDK, so its instrumentation never
 *   patches it.
 * When set, the SDK configures the exporter from the standard `OTEL_*` variables (e.g.
 * `OTEL_METRICS_EXPORTER=otlp`, which also honours `OTEL_EXPORTER_OTLP_METRICS_PROTOCOL`).
 */
export type OtelSignals = { metrics: boolean; logs: boolean };

export const resolveOtelSignals = (): OtelSignals => ({
  metrics: isOtelVariableSet("OTEL_METRICS_EXPORTER"),
  logs: isOtelVariableSet("OTEL_LOGS_EXPORTER"),
});

const buildInstrumentations = (signals: OtelSignals) => [
  getNodeAutoInstrumentations({
    // Very chatty and low value for an API/worker: every file read or DNS lookup becomes a span.
    "@opentelemetry/instrumentation-fs": { enabled: false },
    "@opentelemetry/instrumentation-dns": { enabled: false },
    "@opentelemetry/instrumentation-net": { enabled: false },
    "@opentelemetry/instrumentation-http": { ignoreIncomingRequestHook: isIgnoredIncomingRequest },
    // `createLogger` adds trace_id/span_id itself (pino is loaded before the SDK can patch it).
    "@opentelemetry/instrumentation-pino": {
      disableLogSending: !signals.logs,
      disableLogCorrelation: true,
    },
  }),
  // Official Fastify instrumentation (replaces `@opentelemetry/instrumentation-fastify`, no longer
  // part of the auto-instrumentations). Spans need its plugin: see `getFastifyOtelPlugin`.
  createFastifyInstrumentation(),
];

/** NodeSDK configuration; empty reader/processor lists turn metrics and logs off. */
export function buildSdkConfiguration(
  options: TracingOptions,
  signals: OtelSignals = resolveOtelSignals(),
): Partial<NodeSDKConfiguration> {
  return {
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: options.serviceName,
      [ATTR_SERVICE_VERSION]: options.serviceVersion,
      [ATTR_DEPLOYMENT_ENVIRONMENT_NAME]: options.environment,
    }),
    traceExporter: new OTLPTraceExporter({ url: resolveTracesUrl(options.otlpEndpoint) }),
    instrumentations: buildInstrumentations(signals),
    ...(signals.metrics ? {} : { metricReaders: [] }),
    ...(signals.logs ? {} : { logRecordProcessors: [] }),
  };
}

/**
 * Starts the OpenTelemetry NodeSDK (global tracer provider, W3C propagator and context manager).
 * Traces go to `otlpEndpoint` as OTLP/HTTP JSON; metrics and logs follow {@link OtelSignals}.
 * Sampling uses the SDK's standard configuration (`OTEL_TRACES_SAMPLER` / `OTEL_TRACES_SAMPLER_ARG`,
 * default `parentbased_always_on`): a ratio sampler needs `@opentelemetry/sdk-trace`, which is not
 * a dependency of this package, and tail sampling is usually done in the collector anyway.
 */
export function startTracing(options: TracingOptions): NodeSDK {
  const sdk = new NodeSDK(buildSdkConfiguration(options));
  sdk.start();
  return sdk;
}
