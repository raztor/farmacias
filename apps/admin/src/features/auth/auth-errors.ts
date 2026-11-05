import { INVALID_CREDENTIALS_MESSAGE, isInvalidCredentials } from "@repo/shared";

/** Shape of the `error` returned by Better Auth client calls. */
export type AuthClientError = Readonly<{
  code?: string | undefined;
  message?: string | undefined;
  status: number;
}>;

const GENERIC_ERROR = "No pudimos completar la solicitud. Inténtalo de nuevo en unos minutos.";

const TOO_MANY_REQUESTS = 429;

const MESSAGES_BY_CODE: Readonly<Record<string, string>> = {
  BANNED_USER: "Tu cuenta está suspendida. Contacta a un administrador del programa.",
};

/**
 * User-facing (Spanish) message for a Better Auth sign-in error. Invalid credentials always get
 * the same generic message (HU-02): it never says whether the email or the password failed.
 * Never exposes server details.
 */
export function getAuthErrorMessage(error: AuthClientError): string {
  if (error.status === TOO_MANY_REQUESTS) {
    return "Demasiados intentos. Espera un momento antes de volver a intentarlo.";
  }
  const byCode = error.code === undefined ? undefined : MESSAGES_BY_CODE[error.code];
  if (byCode !== undefined) return byCode;
  if (isInvalidCredentials(error)) return INVALID_CREDENTIALS_MESSAGE;
  return GENERIC_ERROR;
}

/** Message for network failures (API down, offline…). */
export const NETWORK_ERROR_MESSAGE =
  "No pudimos conectarnos con el servidor. Revisa tu conexión e inténtalo de nuevo.";
