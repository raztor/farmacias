import { TRPCClientError } from "@trpc/client";

const GENERIC_ERROR = "Ocurrió un error inesperado. Inténtalo de nuevo en unos minutos.";
const NETWORK_ERROR = "No pudimos conectarnos con el servidor. Revisa tu conexión.";
const UNAUTHORIZED_ERROR = "Tu sesión expiró. Vuelve a iniciar sesión.";

const getHttpStatus = (error: TRPCClientError<never>): number | undefined => {
  const status = (error.data as { httpStatus?: unknown } | undefined)?.httpStatus;
  return typeof status === "number" ? status : undefined;
};

/**
 * `true` for a CONFLICT (409): the data changed since it was loaded (e.g. another operator moved
 * the order first, `STALE_VERSION`) or the action is no longer valid. The screen should reload.
 */
export function isConflictError(error: unknown): boolean {
  return error instanceof TRPCClientError && getHttpStatus(error as TRPCClientError<never>) === 409;
}

/**
 * User-facing message for a tRPC error. Client errors (4xx) carry messages written for users by
 * the API (validation messages come from the shared Spanish schemas); anything else is generic.
 */
export function getTrpcErrorMessage(error: unknown): string {
  if (!(error instanceof TRPCClientError)) return GENERIC_ERROR;
  const status = getHttpStatus(error as TRPCClientError<never>);
  if (status === undefined) return NETWORK_ERROR;
  if (status === 401) return UNAUTHORIZED_ERROR;
  if (status >= 400 && status < 500) return error.message;
  return GENERIC_ERROR;
}
