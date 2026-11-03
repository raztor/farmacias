/** Shape of the `error` returned by Better Auth client calls. */
export type AuthClientError = Readonly<{
  code?: string | undefined;
  message?: string | undefined;
  status: number;
}>;

const GENERIC_ERROR = "No pudimos completar la solicitud. Inténtalo de nuevo en unos minutos.";

const MESSAGES_BY_CODE: Readonly<Record<string, string>> = {
  INVALID_EMAIL_OR_PASSWORD: "Correo o contraseña incorrectos.",
  INVALID_EMAIL: "Ingresa un correo electrónico válido.",
  INVALID_PASSWORD: "Correo o contraseña incorrectos.",
  EMAIL_NOT_VERIFIED: "Debes verificar tu correo antes de iniciar sesión.",
  USER_ALREADY_EXISTS: "Ya existe una cuenta con este correo.",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "Ya existe una cuenta con este correo.",
  PASSWORD_TOO_SHORT: "La contraseña es demasiado corta.",
  PASSWORD_TOO_LONG: "La contraseña es demasiado larga.",
  BANNED_USER: "Tu cuenta está suspendida. Contacta a soporte.",
};

/** User-facing (Spanish) message for a Better Auth error. Never exposes server details. */
export function getAuthErrorMessage(error: AuthClientError): string {
  if (error.status === 429) {
    return "Demasiados intentos. Espera un momento antes de volver a intentarlo.";
  }
  const byCode = error.code === undefined ? undefined : MESSAGES_BY_CODE[error.code];
  return byCode ?? GENERIC_ERROR;
}

/** Message for network failures (API down, offline…). */
export const NETWORK_ERROR_MESSAGE =
  "No pudimos conectarnos con el servidor. Revisa tu conexión e inténtalo de nuevo.";
