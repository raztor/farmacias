import { TRPCClientError } from "@trpc/client";
import { describe, expect, it } from "vitest";

import {
  getApiErrorCode,
  getApiErrorReason,
  getApiErrorText,
  getServerFieldErrors,
  isOutcomeUnknown,
} from "./api-error";

type Data = Record<string, unknown>;

function apiError(message: string, data: Data) {
  return TRPCClientError.from({ error: { message, code: -32_600, data } });
}

describe("getApiErrorCode / getApiErrorReason / getApiErrorText", () => {
  it("reads the tRPC code, the domain reason and the message", () => {
    const error = apiError("No hay stock", {
      code: "CONFLICT",
      httpStatus: 409,
      reason: "STOCK_CONFLICT",
    });

    expect(getApiErrorCode(error)).toBe("CONFLICT");
    expect(getApiErrorReason(error)).toBe("STOCK_CONFLICT");
    expect(getApiErrorText(error)).toBe("No hay stock");
  });

  it("returns nothing for errors that are not from the API", () => {
    expect(getApiErrorCode(new Error("boom"))).toBeUndefined();
    expect(getApiErrorReason("boom")).toBeUndefined();
    expect(getApiErrorText("boom")).toBe("");
  });

  it("ignores a reason that is not a string", () => {
    expect(getApiErrorReason(apiError("x", { code: "CONFLICT", reason: 3 }))).toBeUndefined();
  });
});

describe("getServerFieldErrors", () => {
  it("returns the first message of each invalid field (HU-04 #2)", () => {
    const error = apiError("Indica el sector", {
      code: "BAD_REQUEST",
      httpStatus: 400,
      zodError: {
        errors: [],
        properties: {
          sector: { errors: ["Indica el sector", "otro"] },
          contactAlias: { errors: ["Indica un alias de contacto"] },
          instructions: { errors: [] },
        },
      },
    });

    expect(getServerFieldErrors(error)).toEqual({
      sector: "Indica el sector",
      contactAlias: "Indica un alias de contacto",
    });
  });

  it("is empty without a validation tree", () => {
    expect(getServerFieldErrors(apiError("x", { code: "CONFLICT", zodError: null }))).toEqual({});
    expect(getServerFieldErrors(new Error("x"))).toEqual({});
  });
});

describe("isOutcomeUnknown", () => {
  it("is true when the server may have processed the request", () => {
    expect(isOutcomeUnknown(TRPCClientError.from(new TypeError("Network request failed")))).toBe(
      true,
    );
    expect(
      isOutcomeUnknown(apiError("x", { code: "INTERNAL_SERVER_ERROR", httpStatus: 500 })),
    ).toBe(true);
    expect(isOutcomeUnknown(apiError("x", { code: "TOO_MANY_REQUESTS", httpStatus: 429 }))).toBe(
      true,
    );
    expect(isOutcomeUnknown(new Error("unexpected"))).toBe(true);
  });

  it("is false for definitive answers", () => {
    expect(isOutcomeUnknown(apiError("x", { code: "CONFLICT", httpStatus: 409 }))).toBe(false);
    expect(isOutcomeUnknown(apiError("x", { code: "BAD_REQUEST", httpStatus: 400 }))).toBe(false);
    expect(isOutcomeUnknown(apiError("x", { code: "NOT_FOUND", httpStatus: 404 }))).toBe(false);
  });
});
