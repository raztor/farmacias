import { TRPCClientError } from "@trpc/client";
import { describe, expect, it } from "vitest";

import { MAX_QUERY_RETRIES, isUnauthorizedError, shouldRetryQuery } from "./retry-policy";

function apiError(code: string, httpStatus: number) {
  return TRPCClientError.from({
    error: { message: code, code: -32_600, data: { code, httpStatus } },
  });
}

describe("shouldRetryQuery", () => {
  it.each([
    ["BAD_REQUEST", 400],
    ["UNAUTHORIZED", 401],
    ["FORBIDDEN", 403],
    ["NOT_FOUND", 404],
    ["CONFLICT", 409],
    ["UNPROCESSABLE_CONTENT", 422],
  ])("does not retry %s (%i)", (code, status) => {
    expect(shouldRetryQuery(0, apiError(code, status))).toBe(false);
  });

  it.each([
    ["INTERNAL_SERVER_ERROR", 500],
    ["SERVICE_UNAVAILABLE", 503],
    ["TOO_MANY_REQUESTS", 429],
  ])("retries %s (%i)", (code, status) => {
    expect(shouldRetryQuery(0, apiError(code, status))).toBe(true);
  });

  it("retries network failures and unknown errors", () => {
    expect(shouldRetryQuery(0, TRPCClientError.from(new TypeError("offline")))).toBe(true);
    expect(shouldRetryQuery(0, new Error("boom"))).toBe(true);
  });

  it(`stops after ${String(MAX_QUERY_RETRIES)} retries`, () => {
    const error = apiError("INTERNAL_SERVER_ERROR", 500);

    expect(shouldRetryQuery(MAX_QUERY_RETRIES - 1, error)).toBe(true);
    expect(shouldRetryQuery(MAX_QUERY_RETRIES, error)).toBe(false);
    expect(shouldRetryQuery(MAX_QUERY_RETRIES + 1, error)).toBe(false);
  });
});

describe("isUnauthorizedError", () => {
  it("detects an expired or missing session", () => {
    expect(isUnauthorizedError(apiError("UNAUTHORIZED", 401))).toBe(true);
  });

  it("ignores other errors", () => {
    expect(isUnauthorizedError(apiError("FORBIDDEN", 403))).toBe(false);
    expect(isUnauthorizedError(TRPCClientError.from(new TypeError("offline")))).toBe(false);
    expect(isUnauthorizedError(new Error("UNAUTHORIZED"))).toBe(false);
  });
});
