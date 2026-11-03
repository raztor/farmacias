import { describe, expect, it } from "vitest";

import { isAdminRole, toRole } from "./role";

describe("toRole", () => {
  it("falls back to user for missing or unknown values", () => {
    expect(toRole(null)).toBe("user");
    expect(toRole(undefined)).toBe("user");
    expect(toRole("")).toBe("user");
    expect(toRole("superuser")).toBe("user");
  });

  it("recognizes admin, including comma-separated role lists", () => {
    expect(toRole("admin")).toBe("admin");
    expect(toRole("user, admin")).toBe("admin");
    expect(toRole("user")).toBe("user");
  });
});

describe("isAdminRole", () => {
  it("is true only for admins", () => {
    expect(isAdminRole("admin")).toBe(true);
    expect(isAdminRole("user")).toBe(false);
    expect(isAdminRole(null)).toBe(false);
  });
});
