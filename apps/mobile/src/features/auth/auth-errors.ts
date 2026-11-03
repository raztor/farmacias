import {
  INVALID_CREDENTIALS_MESSAGE,
  RESIDENT_APP_ONLY_MESSAGE,
  isInvalidCredentials,
} from "@repo/shared";

import { GENERIC_ERROR_MESSAGE, NETWORK_ERROR_MESSAGE } from "../../lib/error-message";

/** Shape of the `error` returned by Better Auth client calls. */
export type AuthClientError = {
  code?: string | undefined;
  message?: string | undefined;
  status: number;
};

/** Client-side code: valid credentials of an operator/admin account (not for this app). */
export const RESIDENT_APP_ONLY_CODE = "RESIDENT_APP_ONLY";

const AUTH_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  [RESIDENT_APP_ONLY_CODE]: RESIDENT_APP_ONLY_MESSAGE,
  BANNED_USER: "Tu cuenta está suspendida. Acércate a la Farmacia Comunitaria para revisarla.",
};

const TOO_MANY_REQUESTS = 429;
const TOO_MANY_REQUESTS_MESSAGE = "Demasiados intentos. Espera un momento e inténtalo de nuevo.";

/** Error thrown by the auth hooks so TanStack Query exposes it as `mutation.error`. */
export class AuthRequestError extends Error {
  readonly code: string | undefined;
  readonly status: number;

  constructor(error: AuthClientError) {
    super(error.message ?? error.code ?? "Auth request failed");
    this.name = "AuthRequestError";
    this.code = error.code;
    this.status = error.status;
  }
}

function messageForAuthError(error: AuthRequestError): string {
  const known = error.code === undefined ? undefined : AUTH_ERROR_MESSAGES[error.code];
  if (known !== undefined) return known;
  // HU-02: one generic message, never which field (or whether the account) was wrong.
  if (isInvalidCredentials(error)) return INVALID_CREDENTIALS_MESSAGE;
  if (error.status === TOO_MANY_REQUESTS) return TOO_MANY_REQUESTS_MESSAGE;
  if (error.status === 0) return NETWORK_ERROR_MESSAGE;
  return GENERIC_ERROR_MESSAGE;
}

/** User-facing (Spanish) message for any error thrown by an auth mutation. Pure. */
export function getAuthErrorMessage(error: unknown): string {
  if (error instanceof AuthRequestError) return messageForAuthError(error);
  // `fetch` rejects with a TypeError when the server cannot be reached.
  if (error instanceof TypeError) return NETWORK_ERROR_MESSAGE;
  return GENERIC_ERROR_MESSAGE;
}
