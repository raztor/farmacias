import { describe, expect, it } from "vitest";

import { USER_SEARCH_MAX_LENGTH, userSearchSchema } from "./users.schema";

describe("userSearchSchema", () => {
  it("trims the search term", () => {
    expect(userSearchSchema.parse("  ana  ")).toBe("ana");
  });

  it("treats a blank search as no filter", () => {
    expect(userSearchSchema.parse("")).toBeUndefined();
    expect(userSearchSchema.parse("   ")).toBeUndefined();
  });

  it("accepts the maximum length and rejects longer terms", () => {
    expect(userSearchSchema.safeParse("a".repeat(USER_SEARCH_MAX_LENGTH)).success).toBe(true);

    const result = userSearchSchema.safeParse("a".repeat(USER_SEARCH_MAX_LENGTH + 1));
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(
      `Máximo ${String(USER_SEARCH_MAX_LENGTH)} caracteres.`,
    );
  });
});
