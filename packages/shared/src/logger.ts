/** Log method shape shared by pino and any structured logger: context object first. */
export type LogFn = (obj: object, msg?: string) => void;

/**
 * Minimal structured logger contract. pino satisfies it structurally, so packages
 * that must stay free of Node APIs (api, queue) can log without depending on pino.
 */
export type AppLogger = {
  debug: LogFn;
  info: LogFn;
  warn: LogFn;
  error: LogFn;
  child: (bindings: Record<string, unknown>) => AppLogger;
};

const noop: LogFn = () => undefined;

/** Logger that discards every entry. Useful as a default for optional loggers and in tests. */
export const noopLogger: AppLogger = {
  debug: noop,
  info: noop,
  warn: noop,
  error: noop,
  child: () => noopLogger,
};
