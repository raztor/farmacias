import { captureRequestError } from "@sentry/nextjs";

/**
 * Next.js server instrumentation. Sentry only runs on the Node.js runtime: the app has no Edge
 * routes and `proxy.ts` runs on Node.js in Next.js 16.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
}

/** Reports errors from Server Components, Route Handlers, Server Actions and the proxy. */
export const onRequestError = captureRequestError;
