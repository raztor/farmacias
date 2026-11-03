import { describe, expect, it } from "vitest";

import { signInSchema, signUpSchema } from "./auth.schema";

describe("signInSchema", () => {
  it("normalizes the email and accepts any non-empty password", () => {
    expect(signInSchema.parse({ email: "ANA@EXAMPLE.CL", password: "old" })).toEqual({
      email: "ana@example.cl",
      password: "old",
    });
  });

  it("requires both fields", () => {
    const result = signInSchema.safeParse({ email: "", password: "" });
    expect(result.error?.issues.map((issue) => issue.path.join("."))).toEqual([
      "email",
      "password",
    ]);
  });
});

describe("signUpSchema", () => {
  const valid = { name: "Ana", email: "ana@example.cl", password: "12345678" };

  it("accepts a valid payload", () => {
    expect(signUpSchema.parse(valid)).toEqual(valid);
  });

  it("enforces the password policy", () => {
    const result = signUpSchema.safeParse({ ...valid, password: "1234" });
    expect(result.error?.issues[0]?.path).toEqual(["password"]);
  });

  it("strips unknown keys", () => {
    expect(signUpSchema.parse({ ...valid, role: "admin" })).toEqual(valid);
  });
});
