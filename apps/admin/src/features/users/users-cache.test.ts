import { ROLES } from "@repo/shared";
import { describe, expect, it } from "vitest";

import {
  findUserRole,
  updateUserInPages,
  withUser,
  withUserRole,
  type AdminUser,
  type UsersInfiniteData,
} from "./users-cache";

function user(id: string, overrides: Partial<AdminUser> = {}): AdminUser {
  return {
    id,
    email: `${id}@correo.cl`,
    name: `Usuario ${id}`,
    image: null,
    role: ROLES.user,
    emailVerified: true,
    banned: false,
    createdAt: new Date("2026-01-01T12:00:00Z"),
    ...overrides,
  };
}

function cache(): UsersInfiniteData {
  return {
    pages: [
      { items: [user("u1"), user("u2", { role: ROLES.admin })], nextCursor: "u2" },
      { items: [user("u3")], nextCursor: null },
    ],
    pageParams: [null, "u2"],
  };
}

describe("updateUserInPages", () => {
  it("updates only the matching user and keeps the page structure", () => {
    const data = cache();
    const next = updateUserInPages(data, "u3", (row) => ({ ...row, name: "Ana" }));

    expect(next.pages[1]?.items[0]?.name).toBe("Ana");
    expect(next.pages[0]?.items).toEqual(data.pages[0]?.items);
    expect(next.pageParams).toEqual(data.pageParams);
    expect(next.pages.map((page) => page.nextCursor)).toEqual(["u2", null]);
  });

  it("does not mutate the cached data", () => {
    const data = cache();
    const snapshot = structuredClone(data);

    updateUserInPages(data, "u1", (row) => ({ ...row, name: "Otro" }));

    expect(data).toEqual(snapshot);
  });

  it("returns an equivalent copy when the user is not cached", () => {
    const data = cache();

    expect(updateUserInPages(data, "missing", (row) => ({ ...row, name: "X" }))).toEqual(data);
  });
});

describe("withUserRole", () => {
  it("changes the role optimistically", () => {
    const next = withUserRole(cache(), "u1", ROLES.admin);

    expect(findUserRole(next, "u1")).toBe(ROLES.admin);
    expect(findUserRole(next, "u2")).toBe(ROLES.admin);
    expect(findUserRole(next, "u3")).toBe(ROLES.user);
  });
});

describe("withUser", () => {
  it("replaces the cached row with the one returned by the API", () => {
    const updated = user("u2", { role: ROLES.user, name: "Bea", banned: true });

    expect(withUser(cache(), updated).pages[0]?.items[1]).toEqual(updated);
  });
});

describe("findUserRole", () => {
  it("finds users in any page", () => {
    expect(findUserRole(cache(), "u2")).toBe(ROLES.admin);
    expect(findUserRole(cache(), "u3")).toBe(ROLES.user);
  });

  it("returns null when the user or the cache is missing", () => {
    expect(findUserRole(cache(), "missing")).toBeNull();
    expect(findUserRole(undefined, "u1")).toBeNull();
  });
});
