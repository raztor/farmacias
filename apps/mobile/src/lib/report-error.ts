import * as Sentry from "@sentry/react-native";

import { GENERIC_ERROR_MESSAGE, getApiErrorMessage } from "./error-message";

/**
 * Reports an unexpected error to Sentry. A no-op when Sentry is not initialized (no DSN),
 * which keeps call sites free of environment checks.
 */
export function reportError(error: unknown, context?: Record<string, unknown>): void {
  Sentry.captureException(error, context === undefined ? undefined : { extra: context });
}

/** Reports API errors that are not expected domain errors (use it in `onError`). */
export function reportUnexpectedApiError(error: unknown): void {
  if (getApiErrorMessage(error) === GENERIC_ERROR_MESSAGE) reportError(error, { scope: "api" });
}
