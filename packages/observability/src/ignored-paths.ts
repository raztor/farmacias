/** Probe endpoints polled by orchestrators: tracing them only adds noise. */
export const IGNORED_INCOMING_PATHS: ReadonlySet<string> = new Set(["/health", "/ready"]);
