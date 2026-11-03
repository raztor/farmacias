import type { PrismaClient } from "@repo/db";
import type { Role } from "@repo/shared";
import { describe, expect, it } from "vitest";

import { AUTH_ROLES } from "./access-control";
import { createAuth } from "./create-auth";

/** Role-only permission checks never touch the database. */
const auth = createAuth({
  db: {} as PrismaClient,
  secret: "test-secret-with-at-least-32-characters!!",
  baseURL: "http://localhost:4000",
  trustedOrigins: [],
  isProduction: false,
});

/** Permission request of `userHasPermission` (also accepted by `Role#authorize`). */
type Permissions = NonNullable<
  Parameters<typeof auth.api.userHasPermission>[0]
>["body"]["permissions"];

const hasPermission = async (role: Role, permissions: Permissions): Promise<boolean> => {
  const result = await auth.api.userHasPermission({ body: { role, permissions } });
  return result.success;
};

describe("AUTH_ROLES", () => {
  it("registers exactly the three application roles", () => {
    expect(Object.keys(AUTH_ROLES)).toEqual(["resident", "operator", "admin"]);
  });

  it.each([
    ["resident", { order: ["create", "pay"] }, true],
    ["resident", { operations: ["read"] }, false],
    ["resident", { user: ["list"] }, false],
    ["operator", { operations: ["read", "transition"] }, true],
    ["operator", { order: ["create"] }, false],
    ["operator", { user: ["list"] }, false],
    ["operator", { user: ["set-role"] }, false],
    ["operator", { audit: ["read"] }, false],
    ["admin", { operations: ["transition"] }, true],
    ["admin", { users: ["set-role"], audit: ["read"] }, true],
    ["admin", { user: ["create", "list", "set-role", "ban"] }, true],
    ["admin", { order: ["create"] }, false],
  ] satisfies [Role, Permissions, boolean][])("%s → %j is %s", (role, permissions, expected) => {
    const result = AUTH_ROLES[role].authorize(permissions);

    expect(result.success).toBe(expected);
  });
});

describe("admin plugin permission checks", () => {
  it("lets only admins manage accounts through the /admin endpoints", async () => {
    const manageUsers: Permissions = { user: ["list", "set-role"] };

    await expect(hasPermission("admin", manageUsers)).resolves.toBe(true);
    await expect(hasPermission("operator", manageUsers)).resolves.toBe(false);
    await expect(hasPermission("resident", manageUsers)).resolves.toBe(false);
  });

  it("evaluates the domain statements with the same matrix as the API guards", async () => {
    await expect(hasPermission("operator", { operations: ["transition"] })).resolves.toBe(true);
    await expect(hasPermission("resident", { operations: ["transition"] })).resolves.toBe(false);
    await expect(hasPermission("resident", { order: ["create"] })).resolves.toBe(true);
  });
});
