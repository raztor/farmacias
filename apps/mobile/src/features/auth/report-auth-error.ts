import { GENERIC_ERROR_MESSAGE } from "../../lib/error-message";
import { reportError } from "../../lib/report-error";
import { getAuthErrorMessage } from "./auth-errors";

/** Reports auth errors that are not expected outcomes (wrong password, duplicates…). */
export function reportUnexpectedAuthError(error: unknown): void {
  if (getAuthErrorMessage(error) === GENERIC_ERROR_MESSAGE) reportError(error, { scope: "auth" });
}
