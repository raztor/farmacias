import { isSpanContextValid, trace } from "@opentelemetry/api";
import { pino } from "pino";

import { RUNTIME_ENV } from "./env";
import { REDACT_PATHS, REDACTED } from "./redaction";

/** Structured logger used across Node.js services (satisfies `AppLogger` from `@repo/shared`). */
export type Logger = pino.Logger;

/** Log levels accepted by {@link createLogger}. */
export type LogLevel = pino.LevelWithSilent;

/** Where log lines are written; defaults to stdout. Mainly useful for tests. */
export type LogDestination = pino.DestinationStream;

export type CreateLoggerOptions = {
  /** Logical service name (`server`, `worker`...), added to every log line as `service`. */
  service: string;
  /** Minimum level to emit. Defaults to `info`. */
  level?: LogLevel;
  /**
   * Human-readable output through `pino-pretty` (worker-thread transport). Local development only:
   * production must emit JSON lines for the log collector. Ignored when `destination` is set.
   */
  pretty?: boolean;
  /** Deployment environment added as `env`. Defaults to `NODE_ENV` (or `development`). */
  environment?: string;
  /** Custom destination stream (e.g. an in-memory stream in tests). */
  destination?: LogDestination;
};

const PRETTY_TRANSPORT = {
  target: "pino-pretty",
  options: { colorize: true, translateTime: "SYS:HH:MM:ss.l", ignore: "pid,hostname" },
} satisfies pino.TransportSingleOptions;

type TraceFields = { trace_id?: string; span_id?: string; trace_flags?: string };

/**
 * Adds the active OpenTelemetry span to every record (same keys as
 * `@opentelemetry/instrumentation-pino`) so logs and traces can be joined. It is done here because
 * that instrumentation cannot patch pino: the bundles load it with the observability code itself,
 * before the SDK starts. Without tracing there is no active span and nothing is added.
 */
const traceContextMixin = (): TraceFields => {
  const spanContext = trace.getActiveSpan()?.spanContext();
  if (spanContext === undefined || !isSpanContextValid(spanContext)) {
    return {};
  }
  return {
    trace_id: spanContext.traceId,
    span_id: spanContext.spanId,
    trace_flags: spanContext.traceFlags.toString(16).padStart(2, "0"),
  };
};

/**
 * Creates a pino logger with `service`/`env` bindings, the active trace (`trace_id`, `span_id`)
 * and redaction of credentials and secrets.
 */
export function createLogger(options: CreateLoggerOptions): Logger {
  const service = options.service.trim();
  if (service.length === 0) {
    throw new Error("createLogger: `service` must be a non-empty string");
  }

  const loggerOptions: pino.LoggerOptions = {
    level: options.level ?? "info",
    base: { service, env: options.environment ?? RUNTIME_ENV },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: { level: (label) => ({ level: label }) },
    redact: { paths: [...REDACT_PATHS], censor: REDACTED },
    mixin: traceContextMixin,
  };

  if (options.destination !== undefined) {
    return pino(loggerOptions, options.destination);
  }
  if (options.pretty === true) {
    return pino({ ...loggerOptions, transport: PRETTY_TRANSPORT });
  }
  return pino(loggerOptions);
}
