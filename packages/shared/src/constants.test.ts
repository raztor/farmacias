import { describe, expect, it } from "vitest";

import { APP_NAME, APP_SCHEME, AUTH_COOKIE_PREFIX, ROLES, ROLE_VALUES, isRole } from "./constants";

describe("constants", () => {
  it("exposes the product name", () => {
    expect(APP_NAME).toBe("Farmacia Comunitaria Peñalolén");
  });

  it("exposes the mobile deep link scheme", () => {
    expect(APP_SCHEME).toBe("bnp");
  });

  it("prefixes auth cookies with the app scheme", () => {
    expect(AUTH_COOKIE_PREFIX).toBe("bnp");
  });

  it("lists every role", () => {
    expect(ROLES).toEqual({ user: "user", admin: "admin" });
    expect(ROLE_VALUES).toEqual(["user", "admin"]);
  });

  it.each([
    ["user", true],
    ["admin", true],
    ["root", false],
    [undefined, false],
  ])("isRole(%j) is %s", (value, expected) => {
    expect(isRole(value)).toBe(expected);
  });
});
