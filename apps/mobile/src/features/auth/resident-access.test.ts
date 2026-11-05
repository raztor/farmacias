import { describe, expect, it } from "vitest";

import { canUseResidentApp } from "./resident-access";

describe("canUseResidentApp", () => {
  it("lets residents in", () => {
    expect(canUseResidentApp({ role: "resident" })).toBe(true);
  });

  it.each(["operator", "admin", "resident,operator"])(
    "keeps %s accounts out (they use the back office)",
    (role) => {
      expect(canUseResidentApp({ role })).toBe(false);
    },
  );

  it("treats a missing or unknown role as resident (least privileged)", () => {
    expect(canUseResidentApp({})).toBe(true);
    expect(canUseResidentApp({ role: null })).toBe(true);
    expect(canUseResidentApp({ role: "user" })).toBe(true);
  });

  it("is false without a signed-in user", () => {
    expect(canUseResidentApp(null)).toBe(false);
    expect(canUseResidentApp(undefined)).toBe(false);
  });
});
