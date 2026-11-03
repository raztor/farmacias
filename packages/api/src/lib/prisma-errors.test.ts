import { describe, expect, it } from "vitest";

import { isRecordNotFoundError } from "./prisma-errors";

describe("isRecordNotFoundError", () => {
  it("matches Prisma's P2025 error", () => {
    expect(isRecordNotFoundError(Object.assign(new Error("missing"), { code: "P2025" }))).toBe(
      true,
    );
  });

  it("ignores other errors and non-objects", () => {
    expect(isRecordNotFoundError(Object.assign(new Error("unique"), { code: "P2002" }))).toBe(
      false,
    );
    expect(isRecordNotFoundError(new Error("boom"))).toBe(false);
    expect(isRecordNotFoundError("P2025")).toBe(false);
    expect(isRecordNotFoundError(null)).toBe(false);
  });
});
