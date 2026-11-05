import { FastifyOtelInstrumentation } from "@fastify/otel";

import { IGNORED_INCOMING_PATHS } from "./ignored-paths";

/** Fastify plugin of `@fastify/otel`: register it on the root instance before any route. */
export type FastifyOtelPlugin = ReturnType<FastifyOtelInstrumentation["plugin"]>;

let instrumentation: FastifyOtelInstrumentation | undefined;

/** Probe routes are left out, as the HTTP instrumentation already does for their server spans. */
const isIgnoredRoute = (route: { url: string }): boolean => IGNORED_INCOMING_PATHS.has(route.url);

/**
 * Creates (once per process) the official Fastify instrumentation, which `startTracing` hands to
 * the NodeSDK. It does not patch modules: Fastify spans come from the plugin returned by
 * {@link getFastifyOtelPlugin}, so the ESM loader hooks are not involved.
 */
export function createFastifyInstrumentation(): FastifyOtelInstrumentation {
  instrumentation ??= new FastifyOtelInstrumentation({ ignorePaths: isIgnoredRoute });
  return instrumentation;
}

/**
 * The `@fastify/otel` plugin when OpenTelemetry tracing is running in this process (an OTLP
 * endpoint was configured), `undefined` otherwise. Register it right after creating the Fastify
 * instance (`await app.register(plugin)`), before hooks and routes: it wraps every route added
 * afterwards, adding a `request` span plus hook/handler spans and the route template
 * (`http.route`), which also names the HTTP server span (`GET /trpc/:path`).
 */
export function getFastifyOtelPlugin(): FastifyOtelPlugin | undefined {
  return instrumentation?.isEnabled() === true ? instrumentation.plugin() : undefined;
}
