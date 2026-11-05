import { describe, expect, it } from "vitest";
import { z } from "zod";

import { toFieldErrors } from "./zod-form-errors";

const schema = z.object({
  email: z.email({ error: "Correo inválido." }),
  password: z
    .string()
    .min(8, { error: "Mínimo 8 caracteres." })
    .regex(/\d/, { error: "Incluye un número." }),
});

type Values = { email: string; password: string };

function issuesOf(values: Values) {
  const result = schema.safeParse(values);
  if (result.success) throw new Error("Expected the values to be invalid");
  return result.error.issues;
}

describe("toFieldErrors", () => {
  it("returns one message per invalid field", () => {
    const errors = toFieldErrors<Values>(issuesOf({ email: "nope", password: "abcdefgh" }));

    expect(errors).toEqual({ email: "Correo inválido.", password: "Incluye un número." });
  });

  it("keeps only the first issue of a field", () => {
    const errors = toFieldErrors<Values>(issuesOf({ email: "ana@correo.cl", password: "abc" }));

    expect(errors).toEqual({ password: "Mínimo 8 caracteres." });
  });

  it("ignores issues that are not tied to a field", () => {
    const errors = toFieldErrors<Values>([
      { code: "custom", message: "Formulario inválido.", path: [], input: undefined },
    ]);

    expect(errors).toEqual({});
  });

  it("returns no errors when there are no issues", () => {
    expect(toFieldErrors<Values>([])).toEqual({});
  });
});
