import { describe, expect, it } from "vitest";

import { PERMISSION_STATEMENTS, ROLE_PERMISSIONS, can, type Resource } from "./permissions";
import { ROLE_VALUES, isAdmin, isOperational, isResident } from "./roles";

/** Every (resource, action) pair of the matrix. */
const ALL_PERMISSIONS = Object.entries(PERMISSION_STATEMENTS).flatMap(([resource, actions]) =>
  actions.map((action) => [resource as Resource, action] as const),
);

describe("permission matrix", () => {
  it("only grants statements that exist", () => {
    for (const role of ROLE_VALUES) {
      const permissions: Partial<Record<Resource, readonly string[]>> = ROLE_PERMISSIONS[role];
      for (const [resource, actions] of Object.entries(permissions)) {
        const known: readonly string[] = PERMISSION_STATEMENTS[resource as Resource];
        expect(known).toEqual(expect.arrayContaining([...actions]));
      }
    }
  });

  it("matches the documented matrix (docs/specs/auth.md)", () => {
    const matrix = Object.fromEntries(
      ALL_PERMISSIONS.map(([resource, action]) => [
        `${resource}:${action}`,
        ROLE_VALUES.filter((role) => can(role, resource, action as never)),
      ]),
    );

    expect(matrix).toEqual({
      "order:create": ["resident"],
      "order:read-own": ["resident"],
      "order:pay": ["resident"],
      "order:cancel-own": ["resident"],
      "operations:read": ["operator", "admin"],
      "operations:transition": ["operator", "admin"],
      "users:list": ["admin"],
      "users:set-role": ["admin"],
      "audit:read": ["admin"],
      "inventory:read": ["operator", "admin"],
      "inventory:adjust": ["operator", "admin"],
      "catalog:write": ["admin"],
      "reports:read": ["admin"],
    });
  });

  it("is consistent with the role helpers used by the tRPC guards", () => {
    for (const role of ROLE_VALUES) {
      expect(can(role, "order", "create")).toBe(isResident(role));
      expect(can(role, "operations", "transition")).toBe(isOperational(role));
      expect(can(role, "users", "set-role")).toBe(isAdmin(role));
      expect(can(role, "audit", "read")).toBe(isAdmin(role));
      expect(can(role, "inventory", "adjust")).toBe(isOperational(role));
      expect(can(role, "catalog", "write")).toBe(isAdmin(role));
      expect(can(role, "reports", "read")).toBe(isAdmin(role));
    }
  });

  it("normalizes raw role values and treats unknown roles as residents", () => {
    expect(can("resident,admin", "audit", "read")).toBe(true);
    expect(can(null, "order", "create")).toBe(true);
    expect(can("superuser", "operations", "read")).toBe(false);
  });
});
