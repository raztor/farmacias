import { describe, expect, it } from "vitest";

import { signInSchema } from "./auth.schema";

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
