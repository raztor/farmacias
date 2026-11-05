import { beforeEach, describe, expect, it, vi } from "vitest";

import { getAdminAccess, resolveAdminAccess } from "./admin-access";
import { getServerSession, type ServerSession } from "./session";

vi.mock("./session", () => ({ getServerSession: vi.fn() }));

const sessionMock = vi.mocked(getServerSession);

function sessionWithRole(role: string | null): ServerSession {
  return {
    session: { id: "s1", userId: "u1", expiresAt: new Date("2030-01-01T00:00:00Z") },
    user: {
      id: "u1",
      email: "persona@demo.farmacia.cl",
      name: "Persona",
      image: null,
      role,
      emailVerified: true,
    },
  };
}

describe("resolveAdminAccess", () => {
  it("is signed-out without a session", () => {
    expect(resolveAdminAccess(null)).toEqual({ status: "signed-out" });
  });

  it.each(["resident", null, "", "user"])("forbids the role %j (sin acceso)", (role) => {
    const session = sessionWithRole(role);

    expect(resolveAdminAccess(session)).toEqual({ status: "forbidden", session });
  });

  it.each([
    ["operator", "operator"],
    ["admin", "admin"],
    ["resident,admin", "admin"],
  ])("grants access to %j with the effective role %s", (role, effective) => {
    const session = sessionWithRole(role);

    expect(resolveAdminAccess(session)).toEqual({ status: "granted", session, role: effective });
  });
});

describe("getAdminAccess", () => {
  beforeEach(() => {
    sessionMock.mockReset();
  });

  it("resolves the access of the current request's session", async () => {
    const session = sessionWithRole("operator");
    sessionMock.mockResolvedValue(session);

    await expect(getAdminAccess()).resolves.toEqual({
      status: "granted",
      session,
      role: "operator",
    });
  });

  it("propagates API failures instead of treating the user as signed out", async () => {
    sessionMock.mockRejectedValue(new Error("Session lookup failed with HTTP 502"));

    await expect(getAdminAccess()).rejects.toThrow("HTTP 502");
  });
});
