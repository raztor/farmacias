import { init } from "@sentry/nextjs";

import { clientEnv } from "./env";

/** Server-side Sentry (Node.js runtime). No-op without `NEXT_PUBLIC_SENTRY_DSN`. */
const dsn = clientEnv.NEXT_PUBLIC_SENTRY_DSN;

if (dsn !== undefined) {
  init({
    dsn,
    environment: clientEnv.NODE_ENV,
    tracesSampleRate: clientEnv.NODE_ENV === "production" ? 0.1 : 1,
  });
}
