import { describe, expect, it, vi } from "vitest";

import { isUniqueViolationError, retryOnUniqueViolation } from "./transactions";

const uniqueViolation = () => Object.assign(new Error("dup"), { code: "P2002" });

describe("transactions helpers", () => {
  it("detects Prisma unique violations structurally", () => {
    expect(isUniqueViolationError(uniqueViolation())).toBe(true);
    expect(isUniqueViolationError({ code: "P2025" })).toBe(false);
    expect(isUniqueViolationError(null)).toBe(false);
    expect(isUniqueViolationError("P2002")).toBe(false);
  });

  it("retries once after a unique violation", async () => {
    const operation = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(uniqueViolation())
      .mockResolvedValueOnce("ok");
    await expect(retryOnUniqueViolation(operation)).resolves.toBe("ok");
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it("does not retry other errors, nor more than once", async () => {
    const other = vi.fn<() => Promise<string>>().mockRejectedValue(new Error("boom"));
    await expect(retryOnUniqueViolation(other)).rejects.toThrow("boom");
    expect(other).toHaveBeenCalledTimes(1);

    const always = vi.fn<() => Promise<string>>().mockRejectedValue(uniqueViolation());
    await expect(retryOnUniqueViolation(always)).rejects.toMatchObject({ code: "P2002" });
    expect(always).toHaveBeenCalledTimes(2);
  });
});
