import { randomUUID } from "node:crypto";
import type { IncomingMessage } from "node:http";

/** Header used to propagate the correlation id between proxies, clients and this API. */
export const REQUEST_ID_HEADER = "x-request-id";

/**
 * Only short, printable ids are reused: the value ends up in every log line, so anything that
 * could forge log entries or bloat them is replaced by a fresh UUID.
 */
const SAFE_REQUEST_ID = /^[\w.:@-]{1,128}$/;

/** Reuses a safe incoming `x-request-id` or generates a new UUID. */
export const resolveRequestId = (request: Pick<IncomingMessage, "headers">): string => {
  const header = request.headers[REQUEST_ID_HEADER];
  const candidate = Array.isArray(header) ? header[0] : header;
  return candidate !== undefined && SAFE_REQUEST_ID.test(candidate) ? candidate : randomUUID();
};
