import { registerEsmHooks } from "./esm-hooks";
import { closeSentry, initSentry } from "./sentry";
import { startTracing } from "./tracing";

export type ObservabilityOptions = {
  serviceName: string;
  serviceVersion?: string;
  environment: string;
  /** Enables Sentry error reporting when set. */
  sentryDsn?: string;
  /** Enables OpenTelemetry tracing (OTLP/HTTP) when set, e.g. `http://localhost:4318`. */
  otlpEndpoint?: string;
  /**
   * Fraction of traces Sentry samples (0–1) when Sentry owns tracing (no `otlpEndpoint`).
   * Defaults to 0.1 in production and 1 elsewhere. OpenTelemetry sampling follows the standard
   * `OTEL_TRACES_SAMPLER*` variables instead.
   */
  tracesSampleRate?: number;
};

export type Observability = {
  /** Flushes pending spans and Sentry events, then stops both. Idempotent. */
  shutdown: () => Promise<void>;
};

const PRODUCTION_SAMPLE_RATE = 0.1;
const DEFAULT_SAMPLE_RATE = 1;

const nonEmpty = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim();
  return trimmed === undefined || trimmed.length === 0 ? undefined : trimmed;
};

const resolveSampleRate = (options: ObservabilityOptions): number => {
  const rate =
    options.tracesSampleRate ??
    (options.environment === "production" ? PRODUCTION_SAMPLE_RATE : DEFAULT_SAMPLE_RATE);
  if (!Number.isFinite(rate) || rate < 0 || rate > 1) {
    throw new RangeError(`tracesSampleRate must be between 0 and 1, received ${String(rate)}`);
  }
  return rate;
};

const runShutdown = async (tasks: (() => Promise<void>)[]): Promise<void> => {
  const results = await Promise.allSettled(tasks.map((task) => task()));
  const errors = results.flatMap((result): unknown[] =>
    result.status === "rejected" ? [result.reason as unknown] : [],
  );
  if (errors.length > 0) {
    throw new AggregateError(errors, "Observability shutdown failed");
  }
};

/**
 * Starts tracing and error reporting for a Node.js process. Call it before importing the code to
 * instrument (from `instrument.ts`, loaded with `node --import`): ESM imports are linked before any
 * code runs, so a call from the entry point itself is too late to patch them. OpenTelemetry (and
 * its ESM loader hooks, see `registerEsmHooks`) starts only when `otlpEndpoint` is set and Sentry
 * only when `sentryDsn` is set; with neither it is a no-op.
 */
export function initObservability(options: ObservabilityOptions): Observability {
  const serviceName = nonEmpty(options.serviceName);
  if (serviceName === undefined) {
    throw new Error("initObservability: `serviceName` must be a non-empty string");
  }
  const tracesSampleRate = resolveSampleRate(options);
  const otlpEndpoint = nonEmpty(options.otlpEndpoint);
  const sentryDsn = nonEmpty(options.sentryDsn);
  const shared = {
    serviceName,
    serviceVersion: options.serviceVersion,
    environment: options.environment,
  };
  const tasks: (() => Promise<void>)[] = [];

  // OTel first: it registers the global providers that Sentry's OTel integration reads from.
  // The ESM loader hooks go before the SDK so its instrumentations can patch `import`ed modules.
  if (otlpEndpoint !== undefined) {
    registerEsmHooks();
    const sdk = startTracing({ ...shared, otlpEndpoint });
    tasks.push(() => sdk.shutdown());
  }
  if (sentryDsn !== undefined) {
    const otelOwnsTracing = otlpEndpoint !== undefined;
    initSentry({ ...shared, dsn: sentryDsn, tracesSampleRate, otelOwnsTracing });
    tasks.push(closeSentry);
  }

  let pending: Promise<void> | undefined;
  return {
    shutdown: () => {
      pending ??= runShutdown(tasks);
      return pending;
    },
  };
}
