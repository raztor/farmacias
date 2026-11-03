import { describe, expect, it } from "vitest";

import { isAdminRole } from "./admin-role";

describe("isAdminRole", () => {
  it("grants access to the admin role", () => {
    expect(isAdminRole("admin")).toBe(true);
  });

  it("accepts the comma-separated lists stored by Better Auth", () => {
    expect(isAdminRole("user,admin")).toBe(true);
    expect(isAdminRole("user, admin")).toBe(true);
  });

  it("denies every other role", () => {
    expect(isAdminRole("user")).toBe(false);
    expect(isAdminRole("administrator")).toBe(false);
    expect(isAdminRole("Admin")).toBe(false);
    expect(isAdminRole("user,superadmin")).toBe(false);
  });

  it("denies missing roles", () => {
    expect(isAdminRole("")).toBe(false);
    expect(isAdminRole(null)).toBe(false);
    expect(isAdminRole(undefined)).toBe(false);
  });
});
