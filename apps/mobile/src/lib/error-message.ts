import { TRPCClientError } from "@trpc/client";

export const GENERIC_ERROR_MESSAGE = "Ocurrió un error inesperado. Inténtalo de nuevo.";
export const NETWORK_ERROR_MESSAGE =
  "No pudimos conectarnos con el servidor. Revisa tu conexión e inténtalo de nuevo.";

type TrpcErrorData = { code?: string; httpStatus?: number } | undefined;

/**
 * Turns an API error into a message for the user. Domain errors already carry a Spanish
 * message from the API; anything else is shown generically. Pure: safe to call while rendering.
 */
export function getApiErrorMessage(error: unknown): string {
  if (error instanceof TRPCClientError) {
    const data = error.data as TrpcErrorData;
    if (data === undefined) return NETWORK_ERROR_MESSAGE;
    if (data.code !== "INTERNAL_SERVER_ERROR") return error.message;
  }
  return GENERIC_ERROR_MESSAGE;
}
