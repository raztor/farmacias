import { fromNodeHeaders } from "better-auth/node";
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";

import type { AuthRequestHandler } from "../app.types";

export type AuthPluginOptions = {
  auth: AuthRequestHandler;
};

/** Better Auth's base path (its default `basePath`). */
export const AUTH_BASE_PATH = "/api/auth";

/** Headers Fastify computes itself (or that are hop-by-hop) and must not be copied. */
const SKIPPED_RESPONSE_HEADERS = new Set([
  "set-cookie",
  "content-length",
  "transfer-encoding",
  "connection",
  "keep-alive",
]);

const BODYLESS_METHODS = new Set(["GET", "HEAD"]);

/** Builds the Web `Request` Better Auth expects from the Fastify request. */
export const toWebRequest = (request: FastifyRequest): Request => {
  const url = new URL(request.url, `${request.protocol}://${request.host}`);
  const body = request.body;
  const hasBody = !BODYLESS_METHODS.has(request.method) && Buffer.isBuffer(body);
  const headers = fromNodeHeaders(request.headers);
  // Better Auth rate-limits by the single IP in `x-forwarded-for`. Fastify already resolved the
  // client IP honoring `trustProxy`, so hand over exactly that (also drops spoofed values).
  headers.set("x-forwarded-for", request.ip);
  return new Request(url, {
    method: request.method,
    headers,
    body: hasBody ? new Uint8Array(body) : undefined,
  });
};

/**
 * Copies status, headers and body of Better Auth's Web `Response` to the Fastify reply.
 * Multiple `Set-Cookie` headers (session + cache cookies) must stay separate: `Headers#get`
 * would join them with commas, so they are read with `getSetCookie()`.
 */
export const sendWebResponse = async (
  response: Response,
  reply: FastifyReply,
): Promise<FastifyReply> => {
  reply.code(response.status);
  response.headers.forEach((value, key) => {
    if (!SKIPPED_RESPONSE_HEADERS.has(key)) reply.header(key, value);
  });
  const cookies = response.headers.getSetCookie();
  if (cookies.length > 0) reply.header("set-cookie", cookies);
  const body = response.body === null ? null : Buffer.from(await response.arrayBuffer());
  return reply.send(body);
};

/**
 * Serves Better Auth on `GET|POST /api/auth/*`. Registered as an encapsulated plugin: bodies are
 * kept raw (Buffer) so Better Auth parses and validates them itself, whatever the content type.
 */
export const authPlugin: FastifyPluginAsync<AuthPluginOptions> = (app, options) => {
  app.removeAllContentTypeParsers();
  app.addContentTypeParser("*", { parseAs: "buffer" }, (_request, body, done) => {
    done(null, body);
  });

  app.route({
    method: ["GET", "POST"],
    url: `${AUTH_BASE_PATH}/*`,
    handler: async (request, reply) => {
      const response = await options.auth.handler(toWebRequest(request));
      return sendWebResponse(response, reply);
    },
  });

  return Promise.resolve();
};
