import { describe, expect, it } from "vitest";

import {
  DEFAULT_ROLE,
  OPERATIONAL_ROLES,
  ROLE_LABELS,
  ROLE_VALUES,
  ROLES,
  isAdmin,
  isOperational,
  isResident,
  isRole,
  toRole,
} from "./roles";

describe("roles", () => {
  it("defines the three roles of the Inception report", () => {
    expect(ROLES).toEqual({ resident: "resident", operator: "operator", admin: "admin" });
    expect(ROLE_VALUES).toEqual(["resident", "operator", "admin"]);
    expect(DEFAULT_ROLE).toBe("resident");
    expect(OPERATIONAL_ROLES).toEqual(["operator", "admin"]);
  });

  it("labels every role in Spanish", () => {
    expect(ROLE_LABELS).toEqual({
      resident: "Persona inscrita",
      operator: "Operario",
      admin: "Administrador",
    });
  });

  it.each([
    ["resident", true],
    ["operator", true],
    ["admin", true],
    ["user", false],
    ["Admin", false],
    ["resident,admin", false],
    [undefined, false],
    [42, false],
  ])("isRole(%j) is %s", (value, expected) => {
    expect(isRole(value)).toBe(expected);
  });
});

describe("toRole", () => {
  it.each([null, undefined, "", "user", "superuser", "ADMIN", 1, {}])(
    "falls back to the least privileged role for %j",
    (value) => {
      expect(toRole(value)).toBe("resident");
    },
  );

  it.each([
    ["resident", "resident"],
    ["operator", "operator"],
    ["admin", "admin"],
    ["resident,operator", "operator"],
    ["operator, admin", "admin"],
    ["admin,resident", "admin"],
    ["user,operator", "operator"],
  ])("resolves %j to %s (most privileged known role wins)", (value, expected) => {
    expect(toRole(value)).toBe(expected);
  });
});

describe("role helpers", () => {
  it.each([
    // value, isResident, isOperational, isAdmin
    ["resident", true, false, false],
    ["operator", false, true, false],
    ["admin", false, true, true],
    ["resident,admin", false, true, true],
    [null, true, false, false],
    ["unknown", true, false, false],
  ] as const)("%j → resident=%s operational=%s admin=%s", (value, resident, operational, admin) => {
    expect(isResident(value)).toBe(resident);
    expect(isOperational(value)).toBe(operational);
    expect(isAdmin(value)).toBe(admin);
  });
});
