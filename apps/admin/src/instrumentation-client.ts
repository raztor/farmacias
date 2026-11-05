import { captureRouterTransitionStart, init } from "@sentry/nextjs";

import { clientEnv } from "./env";

/** Browser Sentry. No-op without `NEXT_PUBLIC_SENTRY_DSN`. */
const dsn = clientEnv.NEXT_PUBLIC_SENTRY_DSN;

if (dsn !== undefined) {
  init({
    dsn,
    environment: clientEnv.NODE_ENV,
    tracesSampleRate: clientEnv.NODE_ENV === "production" ? 0.1 : 1,
  });
}

/** Records App Router navigations as Sentry spans. */
export const onRouterTransitionStart = captureRouterTransitionStart;
