import { describe, expect, it } from "vitest";

import {
  emailSchema,
  nameSchema,
  passwordSchema,
  roleSchema,
  updateProfileSchema,
} from "./user.schema";

describe("emailSchema", () => {
  it("trims and lower-cases valid emails", () => {
    expect(emailSchema.parse("  Ana.Perez@Example.CL ")).toBe("ana.perez@example.cl");
  });

  it.each(["", "ana", "ana@", "@example.cl", `${"a".repeat(250)}@x.cl`])("rejects %j", (value) => {
    expect(emailSchema.safeParse(value).success).toBe(false);
  });

  it("returns user-facing messages in Spanish", () => {
    const result = emailSchema.safeParse("no-es-un-correo");
    expect(result.error?.issues[0]?.message).toBe("Ingresa un correo electrónico válido");
    expect(emailSchema.safeParse(undefined).error?.issues[0]?.message).toBe(
      "Ingresa tu correo electrónico",
    );
  });
});

describe("passwordSchema", () => {
  it("accepts 8 to 128 characters without trimming", () => {
    expect(passwordSchema.parse("12345678")).toBe("12345678");
    expect(passwordSchema.parse(" spaced pass ")).toBe(" spaced pass ");
    expect(passwordSchema.safeParse("x".repeat(128)).success).toBe(true);
  });

  it.each(["", "1234567", "x".repeat(129)])("rejects a password of length %#", (value) => {
    expect(passwordSchema.safeParse(value).success).toBe(false);
  });

  it("explains the minimum length", () => {
    expect(passwordSchema.safeParse("short").error?.issues[0]?.message).toBe(
      "La contraseña debe tener al menos 8 caracteres",
    );
  });
});

describe("nameSchema", () => {
  it("trims names", () => {
    expect(nameSchema.parse("  Ana Pérez ")).toBe("Ana Pérez");
  });

  it.each(["", "   ", "x".repeat(101)])("rejects %j", (value) => {
    expect(nameSchema.safeParse(value).success).toBe(false);
  });
});

describe("roleSchema", () => {
  it("accepts known roles only", () => {
    expect(roleSchema.parse("resident")).toBe("resident");
    expect(roleSchema.parse("operator")).toBe("operator");
    expect(roleSchema.parse("admin")).toBe("admin");
    expect(roleSchema.safeParse("user").success).toBe(false);
    expect(roleSchema.safeParse("root").success).toBe(false);
  });
});

describe("updateProfileSchema", () => {
  it("validates the profile payload", () => {
    expect(updateProfileSchema.parse({ name: " Ana " })).toEqual({ name: "Ana" });
    expect(updateProfileSchema.safeParse({}).success).toBe(false);
  });
});
