import { describe, expect, it } from "vitest";

import { getAuthErrorMessage } from "./auth-errors";

describe("getAuthErrorMessage", () => {
  it.each([
    ["INVALID_EMAIL_OR_PASSWORD", "Correo o contraseña incorrectos."],
    ["INVALID_PASSWORD", "Correo o contraseña incorrectos."],
    ["EMAIL_NOT_VERIFIED", "Debes verificar tu correo antes de iniciar sesión."],
    ["BANNED_USER", "Tu cuenta está suspendida. Contacta a soporte."],
  ])("maps %s to a Spanish message", (code, expected) => {
    expect(getAuthErrorMessage({ code, status: 401 })).toBe(expected);
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
