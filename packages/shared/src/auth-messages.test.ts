import { describe, expect, it } from "vitest";

import { INVALID_CREDENTIALS_MESSAGE, isInvalidCredentials } from "./auth-messages";

describe("INVALID_CREDENTIALS_MESSAGE", () => {
  it("is generic: it does not single out the email or the password", () => {
    expect(INVALID_CREDENTIALS_MESSAGE).toBe(
      "Correo o contraseña incorrectos. Revisa tus datos e inténtalo de nuevo.",
    );
  });
});

describe("isInvalidCredentials", () => {
  it.each([
    "INVALID_EMAIL_OR_PASSWORD",
    "INVALID_EMAIL",
    "INVALID_PASSWORD",
    "USER_NOT_FOUND",
    "USER_EMAIL_NOT_FOUND",
    "CREDENTIAL_ACCOUNT_NOT_FOUND",
  ])("treats %s as invalid credentials", (code) => {
    expect(isInvalidCredentials({ code, status: 400 })).toBe(true);
  });

  it("treats any HTTP 401 as invalid credentials", () => {
    expect(isInvalidCredentials({ status: 401 })).toBe(true);
    expect(isInvalidCredentials({ code: "SOMETHING_NEW", status: 401 })).toBe(true);
  });

  it("does not hide other failures (rate limit, bans, server errors)", () => {
    expect(isInvalidCredentials({ status: 429 })).toBe(false);
    expect(isInvalidCredentials({ code: "BANNED_USER", status: 403 })).toBe(false);
    expect(isInvalidCredentials({ status: 500 })).toBe(false);
  });
});
