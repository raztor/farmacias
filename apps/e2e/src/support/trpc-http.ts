import type { APIRequestContext, APIResponse } from "@playwright/test";

/**
 * Minimal tRPC-over-HTTP client for test data setup and API assertions. The API uses the
 * superjson transformer, so inputs travel as `{ json: input }` and outputs come back as
 * `{ result: { data: { json } } }`; errors as `{ error: { json: { message, data: { code } } } }`.
 * Plain JSON inputs need no superjson `meta`. Dates in outputs stay ISO strings (unused here).
 *
 * The request context carries the Better Auth session cookie (see `api-session.ts`).
 */

export type JsonRecord = Readonly<Record<string, unknown>>;

/** A tRPC error answered by the API (e.g. `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`). */
export class TrpcCallError extends Error {
  readonly code: string;
  readonly httpStatus: number;

  constructor(path: string, code: string, httpStatus: number, message: string) {
    super(`${path} → ${code} (${String(httpStatus)}): ${message}`);
    this.name = "TrpcCallError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

export const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const field = (value: unknown, key: string): unknown => (isRecord(value) ? value[key] : undefined);

const toError = (path: string, status: number, body: unknown): TrpcCallError => {
  const error = field(field(body, "error"), "json");
  const message = field(error, "message");
  const code = field(field(error, "data"), "code");
  return new TrpcCallError(
    path,
    typeof code === "string" ? code : "UNKNOWN",
    status,
    typeof message === "string" ? message : "unexpected response",
  );
};

const unwrap = async (path: string, response: APIResponse): Promise<unknown> => {
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok()) throw toError(path, response.status(), body);
  const data = field(field(body, "result"), "data");
  if (!isRecord(data) || !("json" in data)) {
    throw new TrpcCallError(path, "UNKNOWN", response.status(), "missing result.data.json");
  }
  return data.json;
};

export type TrpcClient = Readonly<{
  query: (path: string, input?: JsonRecord) => Promise<unknown>;
  mutation: (path: string, input?: JsonRecord) => Promise<unknown>;
}>;

/** tRPC client bound to a Playwright request context whose `baseURL` is the API origin. */
export function createTrpcClient(request: APIRequestContext): TrpcClient {
  return {
    query: async (path, input) => {
      const params = new URLSearchParams();
      if (input !== undefined) params.set("input", JSON.stringify({ json: input }));
      return unwrap(path, await request.get(`/trpc/${path}`, { params }));
    },
    mutation: async (path, input) =>
      unwrap(
        path,
        await request.post(`/trpc/${path}`, { data: input === undefined ? {} : { json: input } }),
      ),
  };
}

/** Runs `call` and returns the tRPC error code it failed with (fails when it succeeds). */
export async function trpcErrorCode(call: () => Promise<unknown>): Promise<string> {
  try {
    await call();
  } catch (error: unknown) {
    if (error instanceof TrpcCallError) return error.code;
    throw error;
  }
  throw new Error("Expected the tRPC call to fail, but it succeeded");
}
