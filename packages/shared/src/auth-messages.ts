/**
 * Sign-in messages shared by both clients (HU-02, RNF-09). The invalid-credentials message is
 * deliberately generic: it never says whether the email or the password was wrong.
 */
export const INVALID_CREDENTIALS_MESSAGE =
  "Correo o contraseña incorrectos. Revisa tus datos e inténtalo de nuevo.";

/** Shown by the resident app when an operator or admin signs in. */
export const RESIDENT_APP_ONLY_MESSAGE =
  "Esta app es para personas inscritas. Si trabajas en la farmacia, ingresa al sistema de administración desde un computador.";

/** Shown by the back office to signed-in residents. */
export const BACKOFFICE_ONLY_MESSAGE =
  "Esta sección es solo para el personal autorizado de la farmacia. Si eres persona inscrita, usa la app de la Farmacia Comunitaria.";

/**
 * Better Auth error codes that mean "these credentials are not valid". All of them are shown
 * with {@link INVALID_CREDENTIALS_MESSAGE} so the response never reveals which field failed or
 * whether the account exists.
 */
const INVALID_CREDENTIALS_CODES: ReadonlySet<string> = new Set([
  "INVALID_EMAIL_OR_PASSWORD",
  "INVALID_EMAIL",
  "INVALID_PASSWORD",
  "USER_NOT_FOUND",
  "USER_EMAIL_NOT_FOUND",
  "CREDENTIAL_ACCOUNT_NOT_FOUND",
]);

const HTTP_UNAUTHORIZED = 401;

/** Error returned by the Better Auth client (`{ code?, message?, status }`). */
export type SignInFailure = Readonly<{ code?: string | undefined; status: number }>;

/** `true` when a failed sign-in must be reported with the generic invalid-credentials message. */
export const isInvalidCredentials = (error: SignInFailure): boolean =>
  error.status === HTTP_UNAUTHORIZED ||
  (error.code !== undefined && INVALID_CREDENTIALS_CODES.has(error.code));
