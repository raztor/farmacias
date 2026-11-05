import { TRPCError } from "@trpc/server";
import { AppError, APP_ERROR_CODES } from "@repo/shared";
import { describe, expect, it } from "vitest";

import { INTERNAL_ERROR_MESSAGE, isServerError, toTRPCError } from "./error-mapping";

describe("toTRPCError", () => {
  it.each([
    ["BAD_REQUEST", "BAD_REQUEST"],
    ["UNAUTHORIZED", "UNAUTHORIZED"],
    ["FORBIDDEN", "FORBIDDEN"],
    ["NOT_FOUND", "NOT_FOUND"],
    ["CONFLICT", "CONFLICT"],
  ] as const)("maps AppError %s to %s keeping the message", (appCode, trpcCode) => {
    const appError = new AppError(appCode, "Mensaje para el usuario");

    const mapped = toTRPCError(new TRPCError({ code: "INTERNAL_SERVER_ERROR", cause: appError }));

    expect(mapped).toMatchObject({ code: trpcCode, message: "Mensaje para el usuario" });
    expect(mapped.cause).toBe(appError);
  });

  it("covers every AppError code", () => {
    for (const code of APP_ERROR_CODES) {
      expect(toTRPCError(new AppError(code, "x"))).toBeInstanceOf(TRPCError);
    }
  });

  it("hides the message of INTERNAL AppErrors", () => {
    const mapped = toTRPCError(new AppError("INTERNAL", "Redis at 10.0.0.3 is down"));

    expect(mapped).toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
      message: INTERNAL_ERROR_MESSAGE,
    });
  });

  it("replaces unexpected errors with a generic INTERNAL_SERVER_ERROR", () => {
    const failure = new Error('relation "user" does not exist');

    const fromWrapped = toTRPCError(
      new TRPCError({ code: "INTERNAL_SERVER_ERROR", cause: failure }),
    );
    const fromRaw = toTRPCError(failure);

    for (const mapped of [fromWrapped, fromRaw]) {
      expect(mapped).toMatchObject({
        code: "INTERNAL_SERVER_ERROR",
        message: INTERNAL_ERROR_MESSAGE,
      });
      expect(mapped.cause).toBe(failure);
    }
  });

  it("returns client errors and already-sanitized errors untouched", () => {
    const unauthorized = new TRPCError({ code: "UNAUTHORIZED", message: "Inicia sesión" });
    const sanitized = new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: INTERNAL_ERROR_MESSAGE,
    });

    expect(toTRPCError(unauthorized)).toBe(unauthorized);
    expect(toTRPCError(sanitized)).toBe(sanitized);
  });
});

describe("isServerError", () => {
  it("is true only for INTERNAL_SERVER_ERROR", () => {
    expect(isServerError(new TRPCError({ code: "INTERNAL_SERVER_ERROR" }))).toBe(true);
    expect(isServerError(new TRPCError({ code: "NOT_FOUND" }))).toBe(false);
  });
});
