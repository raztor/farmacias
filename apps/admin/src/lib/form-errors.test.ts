import { describe, expect, it } from "vitest";
import { z } from "zod";

import { validateForm } from "./form-errors";

const schema = z
  .object({
    email: z.email({ error: "Correo inválido." }),
    password: z.string().min(8, { error: "Mínimo 8 caracteres." }),
    confirm: z.string(),
  })
  .refine((values) => values.password === values.confirm, {
    error: "Las contraseñas no coinciden.",
    path: ["confirm"],
  });

describe("validateForm", () => {
  it("returns the parsed data when the values are valid", () => {
    const values = { email: "ana@correo.cl", password: "12345678", confirm: "12345678" };

    expect(validateForm(schema, values)).toEqual({ success: true, data: values });
  });

  it("returns the first message of each invalid field", () => {
    const result = validateForm(schema, { email: "x", password: "123", confirm: "123" });

    expect(result).toEqual({
      success: false,
      errors: { email: "Correo inválido.", password: "Mínimo 8 caracteres." },
    });
  });

  it("maps cross-field refinements to their path", () => {
    const result = validateForm(schema, {
      email: "ana@correo.cl",
      password: "12345678",
      confirm: "87654321",
    });

    expect(result).toEqual({
      success: false,
      errors: { confirm: "Las contraseñas no coinciden." },
    });
  });

  it("ignores issues of fields that are not part of the form", () => {
    const withExtra = z.object({ name: z.string(), token: z.string() });

    expect(validateForm(withExtra, { name: "Ana" })).toEqual({ success: false, errors: {} });
  });
});
