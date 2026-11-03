import { TRPCClientError } from "@trpc/client";
import { describe, expect, it } from "vitest";

import { GENERIC_ERROR_MESSAGE, NETWORK_ERROR_MESSAGE, getApiErrorMessage } from "./error-message";

/** A tRPC error as the client builds it from an API error response. */
function apiError(message: string, code: string, httpStatus: number) {
  return TRPCClientError.from({ error: { message, code: -32_600, data: { code, httpStatus } } });
}

describe("getApiErrorMessage", () => {
  it("shows the Spanish message of domain errors written by the API", () => {
    const error = apiError("El nombre es obligatorio.", "BAD_REQUEST", 400);

    expect(getApiErrorMessage(error)).toBe("El nombre es obligatorio.");
  });

  it("hides the message of internal server errors", () => {
    const error = apiError("Prisma exploded", "INTERNAL_SERVER_ERROR", 500);

    expect(getApiErrorMessage(error)).toBe(GENERIC_ERROR_MESSAGE);
  });

  it("treats a tRPC error without response data as a network error", () => {
    const error = TRPCClientError.from(new TypeError("Network request failed"));

    expect(getApiErrorMessage(error)).toBe(NETWORK_ERROR_MESSAGE);
  });

  it("uses the generic message for anything that is not a tRPC error", () => {
    expect(getApiErrorMessage(new Error("boom"))).toBe(GENERIC_ERROR_MESSAGE);
    expect(getApiErrorMessage(undefined)).toBe(GENERIC_ERROR_MESSAGE);
  });
});
