import type { FastifyInstance } from "fastify";

import type { ErrorReporter } from "../app.types";

const INTERNAL_SERVER_ERROR = 500;
const MIN_ERROR_STATUS = 400;
const MAX_STATUS = 599;

/** JSON body of every error answered by the host (outside tRPC, which has its own format). */
export type ErrorBody = {
  error: string;
  message: string;
  requestId: string;
};

/** Errors thrown by Fastify, its plugins or route handlers (`statusCode`/`code` are optional). */
type HttpError = Error & { statusCode?: number; code?: string };

const resolveStatus = (error: HttpError): number => {
  const status = error.statusCode;
  return status !== undefined && status >= MIN_ERROR_STATUS && status <= MAX_STATUS
    ? status
    : INTERNAL_SERVER_ERROR;
};

/**
 * Uniform JSON errors: 404 for unknown routes, client errors keep their message, and server
 * errors are logged, reported and answered with a generic message (no internals leak).
 */
export const registerErrorHandlers = (app: FastifyInstance, reportError: ErrorReporter): void => {
  app.setNotFoundHandler((request, reply) => {
    const body: ErrorBody = {
      error: "NOT_FOUND",
      message: `No existe la ruta ${request.method} ${request.url}.`,
      requestId: request.id,
    };
    return reply.code(404).send(body);
  });

  app.setErrorHandler<HttpError>((error, request, reply) => {
    const status = resolveStatus(error);
    if (status >= INTERNAL_SERVER_ERROR) {
      request.log.error({ err: error }, "Request failed");
      reportError(error, {
        tags: { requestId: request.id, route: request.routeOptions.url ?? "" },
      });
      const body: ErrorBody = {
        error: "INTERNAL",
        message: "Ocurrió un error inesperado. Intenta nuevamente.",
        requestId: request.id,
      };
      return reply.code(status).send(body);
    }
    request.log.info({ err: error, statusCode: status }, "Request rejected");
    const body: ErrorBody = {
      error: error.code ?? "BAD_REQUEST",
      message: error.message,
      requestId: request.id,
    };
    return reply.code(status).send(body);
  });
};
