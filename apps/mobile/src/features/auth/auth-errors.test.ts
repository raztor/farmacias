import { INVALID_CREDENTIALS_MESSAGE, RESIDENT_APP_ONLY_MESSAGE } from "@repo/shared";
import { describe, expect, it } from "vitest";

import { GENERIC_ERROR_MESSAGE, NETWORK_ERROR_MESSAGE } from "../../lib/error-message";
import { AuthRequestError, RESIDENT_APP_ONLY_CODE, getAuthErrorMessage } from "./auth-errors";

describe("AuthRequestError", () => {
  it("keeps the Better Auth code and status", () => {
    const error = new AuthRequestError({ code: "INVALID_EMAIL_OR_PASSWORD", status: 401 });

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("AuthRequestError");
    expect(error.code).toBe("INVALID_EMAIL_OR_PASSWORD");
    expect(error.status).toBe(401);
    expect(error.message).toBe("INVALID_EMAIL_OR_PASSWORD");
  });

  it("prefers the server message and falls back to a default one", () => {
    expect(new AuthRequestError({ message: "Boom", status: 500 }).message).toBe("Boom");
    expect(new AuthRequestError({ status: 500 }).message).toBe("Auth request failed");
  });
});

describe("getAuthErrorMessage", () => {
  it("shows one generic message for every invalid-credentials failure (HU-02 #2)", () => {
    const failures = [
      { code: "INVALID_EMAIL_OR_PASSWORD", status: 401 }, // unknown email or wrong password
      { code: "INVALID_PASSWORD", status: 401 },
      { code: "INVALID_EMAIL", status: 400 },
      { code: "USER_NOT_FOUND", status: 404 },
      { code: undefined, status: 401 },
    ];

    const messages = failures.map((failure) => getAuthErrorMessage(new AuthRequestError(failure)));

    expect(new Set(messages)).toEqual(new Set([INVALID_CREDENTIALS_MESSAGE]));
  });

  it("tells operators and admins that the app is for residents", () => {
    const error = new AuthRequestError({ code: RESIDENT_APP_ONLY_CODE, status: 403 });

    expect(getAuthErrorMessage(error)).toBe(RESIDENT_APP_ONLY_MESSAGE);
  });

  it("explains a suspended account", () => {
    expect(getAuthErrorMessage(new AuthRequestError({ code: "BANNED_USER", status: 403 }))).toMatch(
      /suspendida/,
    );
  });

  it("explains rate limiting (HTTP 429)", () => {
    const error = new AuthRequestError({ code: "SOMETHING_NEW", status: 429 });

    expect(getAuthErrorMessage(error)).toMatch(/Demasiados intentos/);
  });

  it("treats status 0 (no response) as a network error", () => {
    expect(getAuthErrorMessage(new AuthRequestError({ status: 0 }))).toBe(NETWORK_ERROR_MESSAGE);
  });

  it("treats a fetch TypeError as a network error", () => {
    expect(getAuthErrorMessage(new TypeError("Network request failed"))).toBe(
      NETWORK_ERROR_MESSAGE,
    );
  });

  it("never exposes unknown server errors", () => {
    expect(getAuthErrorMessage(new AuthRequestError({ message: "SQL", status: 500 }))).toBe(
      GENERIC_ERROR_MESSAGE,
    );
    expect(getAuthErrorMessage(new Error("Internal detail"))).toBe(GENERIC_ERROR_MESSAGE);
    expect(getAuthErrorMessage("unexpected")).toBe(GENERIC_ERROR_MESSAGE);
  });
});
