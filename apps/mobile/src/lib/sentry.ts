import * as Sentry from "@sentry/react-native";

import { env } from "../env";

let initialized = false;

/**
 * Initializes Sentry once, only when `EXPO_PUBLIC_SENTRY_DSN` is set. Expo Router navigation
 * is traced through `expoRouterIntegration`.
 */
export function initSentry(): void {
  if (initialized || env.EXPO_PUBLIC_SENTRY_DSN === undefined) return;
  initialized = true;
  Sentry.init({
    dsn: env.EXPO_PUBLIC_SENTRY_DSN,
    environment: __DEV__ ? "development" : "production",
    tracesSampleRate: __DEV__ ? 1 : 0.2,
    integrations: [Sentry.expoRouterIntegration()],
  });
}

export { Sentry };
