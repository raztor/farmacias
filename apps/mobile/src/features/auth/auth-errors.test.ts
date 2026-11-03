import { describe, expect, it } from "vitest";

import { GENERIC_ERROR_MESSAGE, NETWORK_ERROR_MESSAGE } from "../../lib/error-message";
import { AuthRequestError, getAuthErrorMessage } from "./auth-errors";

describe("AuthRequestError", () => {
  it("keeps the Better Auth code and status", () => {
    const error = new AuthRequestError({ code: "USER_ALREADY_EXISTS", status: 422 });

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("AuthRequestError");
    expect(error.code).toBe("USER_ALREADY_EXISTS");
    expect(error.status).toBe(422);
    expect(error.message).toBe("USER_ALREADY_EXISTS");
  });

  it("prefers the server message and falls back to a default one", () => {
    expect(new AuthRequestError({ message: "Boom", status: 500 }).message).toBe("Boom");
    expect(new AuthRequestError({ status: 500 }).message).toBe("Auth request failed");
  });
});

describe("getAuthErrorMessage", () => {
  it.each([
    ["INVALID_EMAIL_OR_PASSWORD", "Correo o contraseña incorrectos."],
    ["INVALID_PASSWORD", "Correo o contraseña incorrectos."],
    ["USER_ALREADY_EXISTS", "Ya existe una cuenta con este correo."],
    ["USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL", "Ya existe una cuenta con este correo."],
    ["PASSWORD_TOO_SHORT", "La contraseña es demasiado corta."],
    ["BANNED_USER", "Tu cuenta está suspendida. Contacta a soporte."],
  ])("maps the code %s to a Spanish message", (code, expected) => {
    expect(getAuthErrorMessage(new AuthRequestError({ code, status: 400 }))).toBe(expected);
  });

  it("gives priority to a known code over the HTTP status", () => {
    const error = new AuthRequestError({ code: "INVALID_EMAIL", status: 429 });

    expect(getAuthErrorMessage(error)).toBe("Ingresa un correo electrónico válido.");
  });

  it("explains rate limiting (HTTP 429) when the code is unknown", () => {
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
