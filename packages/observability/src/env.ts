/**
 * Process-level settings of this package. Only the runtime environment name is read at module
 * load; every app setting is passed explicitly by the app's own validated `env.ts`. The standard
 * `OTEL_*` variables are read by the OpenTelemetry SDK itself; this package only checks whether a
 * few of them are set to pick its defaults.
 */
const DEFAULT_RUNTIME_ENV = "development";

const rawNodeEnv = process.env.NODE_ENV?.trim();

export const RUNTIME_ENV: string =
  rawNodeEnv !== undefined && rawNodeEnv.length > 0 ? rawNodeEnv : DEFAULT_RUNTIME_ENV;

/** Standard OpenTelemetry variables whose presence changes this package's defaults. */
export type OtelSignalVariable = "OTEL_METRICS_EXPORTER" | "OTEL_LOGS_EXPORTER";

/** Whether `name` is set to a non-blank value. Read on every call (not cached). */
export const isOtelVariableSet = (name: OtelSignalVariable): boolean => {
  const value = process.env[name]?.trim();
  return value !== undefined && value.length > 0;
};
