export { registerEsmHooks, type EsmHooksStatus } from "./esm-hooks";
export { getFastifyOtelPlugin, type FastifyOtelPlugin } from "./fastify-otel";
export { initObservability, type Observability, type ObservabilityOptions } from "./init";
export {
  createLogger,
  type CreateLoggerOptions,
  type LogDestination,
  type Logger,
  type LogLevel,
} from "./logger";
export { REDACTED } from "./redaction";
export { captureException, type ExceptionContext } from "./sentry";
