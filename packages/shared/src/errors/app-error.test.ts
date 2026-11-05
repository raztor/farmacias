import { describe, expect, it } from "vitest";

import { AppError, isAppError } from "./app-error";

describe("AppError", () => {
  it("carries code, message, details and cause", () => {
    const cause = new Error("unique constraint");
    const error = new AppError("CONFLICT", "Email already in use", {
      cause,
      details: { field: "email" },
    });

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("AppError");
    expect(error.code).toBe("CONFLICT");
    expect(error.message).toBe("Email already in use");
    expect(error.details).toEqual({ field: "email" });
    expect(error.cause).toBe(cause);
    expect(error.stack).toBeDefined();
  });

  it("leaves cause and details undefined when not provided", () => {
    const error = new AppError("NOT_FOUND", "User not found");
    expect(error.details).toBeUndefined();
    expect("cause" in error).toBe(false);
  });
});

describe("isAppError", () => {
  it("accepts AppError instances", () => {
    expect(isAppError(new AppError("FORBIDDEN", "Nope"))).toBe(true);
  });

  it("accepts structurally equivalent errors from another module instance", () => {
    const foreign = Object.assign(new Error("x"), { name: "AppError", code: "UNAUTHORIZED" });
    expect(isAppError(foreign)).toBe(true);
  });

  it.each([
    new Error("plain"),
    Object.assign(new Error("x"), { name: "AppError", code: "TEAPOT" }),
    { name: "AppError", code: "INTERNAL", message: "not an Error" },
    "AppError",
    null,
    undefined,
  ])("rejects %j", (value) => {
    expect(isAppError(value)).toBe(false);
  });
});
