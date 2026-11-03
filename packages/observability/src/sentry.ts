import * as Sentry from "@sentry/node";

/** Milliseconds to wait for pending Sentry events on shutdown. */
const SENTRY_CLOSE_TIMEOUT_MS = 2000;

/**
 * Privacy-first collection: no cookies, bodies (sign-in payloads carry passwords), DB values or
 * queue payloads (emails). Users are attached explicitly through `captureException` context.
 */
const DATA_COLLECTION = {
  userInfo: false,
  cookies: false,
  httpBodies: [],
  databaseQueryData: false,
  queues: false,
} satisfies NonNullable<Sentry.NodeOptions["dataCollection"]>;

export type SentryOptions = {
  dsn: string;
  serviceName: string;
  serviceVersion?: string;
  environment: string;
  tracesSampleRate: number;
  /** True when OpenTelemetry (NodeSDK) owns tracing in this process. */
  otelOwnsTracing: boolean;
};

/** Extra data attached to a captured exception. */
export type ExceptionContext = {
  tags?: Record<string, string | number | boolean>;
  extra?: Record<string, unknown>;
  user?: { id: string; email?: string };
  level?: "fatal" | "error" | "warning";
};

/**
 * Sentry v11 integration strategy (official "existing OpenTelemetry setup" mode):
 * - `enableOpenTelemetrySetup` stays `false` (its default), so Sentry never registers its own
 *   global tracer provider/propagator and cannot clash with the NodeSDK started by this package.
 * - With OTel active, `openTelemetryIntegration()` attaches errors to the active OTel span/trace
 *   and Sentry's own tracing is disabled (no `tracesSampleRate`) to avoid instrumenting HTTP twice;
 *   spans go to the OTLP collector only. Its runtime diagnostics-channel injection (load-time
 *   rewrites of pg, ioredis... that only feed Sentry spans) is disabled too, so the OTel ESM hooks
 *   are the only loader hooks touching those modules.
 * - Without OTel, Sentry traces on its own with `tracesSampleRate` and its runtime injection.
 */
export function initSentry(options: SentryOptions): void {
  Sentry.init({
    dsn: options.dsn,
    environment: options.environment,
    release: options.serviceVersion,
    dataCollection: DATA_COLLECTION,
    tracesSampleRate: options.otelOwnsTracing ? undefined : options.tracesSampleRate,
    integrations: options.otelOwnsTracing ? [Sentry.openTelemetryIntegration()] : [],
    enableRuntimeChannelInjection: !options.otelOwnsTracing,
    initialScope: { tags: { service: options.serviceName } },
  });
}

/** Flushes pending events and disables the Sentry client. */
export async function closeSentry(): Promise<void> {
  const flushed = await Sentry.close(SENTRY_CLOSE_TIMEOUT_MS);
  if (!flushed) {
    throw new Error(
      `Sentry did not flush pending events within ${String(SENTRY_CLOSE_TIMEOUT_MS)}ms`,
    );
  }
}

/**
 * Reports an error to Sentry. Safe to call when Sentry is disabled (returns `undefined`).
 * @returns the Sentry event id when the error was captured.
 */
export function captureException(error: unknown, context?: ExceptionContext): string | undefined {
  if (!Sentry.isInitialized()) {
    return undefined;
  }
  return Sentry.captureException(error, context);
}
