import { INVALID_CREDENTIALS_MESSAGE } from "@repo/shared";
import { describe, expect, it } from "vitest";

import { getAuthErrorMessage } from "./auth-errors";

describe("getAuthErrorMessage", () => {
  it("shows one generic message for every invalid-credentials failure (HU-02 #2)", () => {
    const failures = [
      { code: "INVALID_EMAIL_OR_PASSWORD", status: 401 }, // unknown email or wrong password
      { code: "INVALID_PASSWORD", status: 401 },
      { code: "INVALID_EMAIL", status: 400 },
      { code: "USER_NOT_FOUND", status: 404 },
      { status: 401 },
    ];

    const messages = failures.map((failure) => getAuthErrorMessage(failure));

    expect(new Set(messages)).toEqual(new Set([INVALID_CREDENTIALS_MESSAGE]));
  });

  it("explains a suspended account", () => {
    expect(getAuthErrorMessage({ code: "BANNED_USER", status: 403 })).toMatch(/suspendida/);
  });

  it("explains rate limiting before looking at the code", () => {
    expect(getAuthErrorMessage({ code: "INVALID_PASSWORD", status: 429 })).toMatch(
      /^Demasiados intentos/,
    );
  });

  it("never exposes unknown codes or server messages", () => {
    const message = getAuthErrorMessage({ code: "DB_DOWN", message: "pg error", status: 500 });

    expect(message).toMatch(/^No pudimos completar la solicitud/);
    expect(getAuthErrorMessage({ status: 500 })).toBe(message);
  });
});
