import { TRPCClientError } from "@trpc/client";
import { describe, expect, it } from "vitest";

import { getTrpcErrorMessage, isConflictError, isRetryableError } from "./trpc-errors";

function apiError(message: string, code: string, httpStatus: number) {
  return TRPCClientError.from({ error: { message, code: -32_600, data: { code, httpStatus } } });
}

describe("getTrpcErrorMessage", () => {
  it.each([
    ["BAD_REQUEST", 400],
    ["FORBIDDEN", 403],
    ["NOT_FOUND", 404],
    ["CONFLICT", 409],
  ])("shows the API message of client errors (%s)", (code, status) => {
    expect(getTrpcErrorMessage(apiError("No puedes quitarte tu propio rol.", code, status))).toBe(
      "No puedes quitarte tu propio rol.",
    );
  });

  it("asks to sign in again on UNAUTHORIZED", () => {
    expect(getTrpcErrorMessage(apiError("UNAUTHORIZED", "UNAUTHORIZED", 401))).toBe(
      "Tu sesión expiró. Vuelve a iniciar sesión.",
    );
  });

  it("hides server errors", () => {
    expect(getTrpcErrorMessage(apiError("Prisma failed", "INTERNAL_SERVER_ERROR", 500))).toMatch(
      /^Ocurrió un error inesperado/,
    );
  });

  it("reports a network error when there is no HTTP status", () => {
    expect(getTrpcErrorMessage(TRPCClientError.from(new TypeError("fetch failed")))).toMatch(
      /^No pudimos conectarnos/,
    );
  });

  it("uses the generic message for non-tRPC errors", () => {
    expect(getTrpcErrorMessage(new Error("boom"))).toMatch(/^Ocurrió un error inesperado/);
    expect(getTrpcErrorMessage(null)).toMatch(/^Ocurrió un error inesperado/);
  });
});

describe("isConflictError", () => {
  it("detects CONFLICT (stale version or invalid transition) only", () => {
    expect(isConflictError(apiError("Este pedido cambió", "CONFLICT", 409))).toBe(true);
    expect(isConflictError(apiError("No encontrado", "NOT_FOUND", 404))).toBe(false);
    expect(isConflictError(new Error("CONFLICT"))).toBe(false);
  });
});

describe("isRetryableError", () => {
  it("does not offer a retry for deterministic client errors", () => {
    expect(isRetryableError(apiError("Rango inválido", "BAD_REQUEST", 400))).toBe(false);
    expect(isRetryableError(apiError("FORBIDDEN", "FORBIDDEN", 403))).toBe(false);
  });

  it("offers a retry for server, network and unknown errors", () => {
    expect(isRetryableError(apiError("boom", "INTERNAL_SERVER_ERROR", 500))).toBe(true);
    expect(isRetryableError(new TRPCClientError("Failed to fetch"))).toBe(true);
    expect(isRetryableError(new Error("x"))).toBe(true);
  });
});
