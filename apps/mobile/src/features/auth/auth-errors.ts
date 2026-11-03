import { GENERIC_ERROR_MESSAGE, NETWORK_ERROR_MESSAGE } from "../../lib/error-message";

/** Shape of the `error` returned by Better Auth client calls. */
export type AuthClientError = {
  code?: string | undefined;
  message?: string | undefined;
  status: number;
};

const AUTH_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  INVALID_EMAIL_OR_PASSWORD: "Correo o contraseña incorrectos.",
  INVALID_EMAIL: "Ingresa un correo electrónico válido.",
  INVALID_PASSWORD: "Correo o contraseña incorrectos.",
  USER_ALREADY_EXISTS: "Ya existe una cuenta con este correo.",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "Ya existe una cuenta con este correo.",
  PASSWORD_TOO_SHORT: "La contraseña es demasiado corta.",
  PASSWORD_TOO_LONG: "La contraseña es demasiado larga.",
  EMAIL_NOT_VERIFIED: "Debes verificar tu correo antes de ingresar.",
  BANNED_USER: "Tu cuenta está suspendida. Contacta a soporte.",
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
