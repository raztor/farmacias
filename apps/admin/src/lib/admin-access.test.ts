import { beforeEach, describe, expect, it, vi } from "vitest";

import { getAdminAccess } from "./admin-access";
import { getServerSession, type ServerSession } from "./session";

vi.mock("./session", () => ({ getServerSession: vi.fn() }));

const sessionMock = vi.mocked(getServerSession);

function sessionWithRole(role: string | null): ServerSession {
  return {
    session: { id: "s1", userId: "u1", expiresAt: new Date("2030-01-01T00:00:00Z") },
    user: {
      id: "u1",
      email: "ana@correo.cl",
      name: "Ana",
      image: null,
      role,
      emailVerified: true,
    },
  };
}

describe("getAdminAccess", () => {
  beforeEach(() => {
    sessionMock.mockReset();
  });

  it("is signed-out without a session", async () => {
    sessionMock.mockResolvedValue(null);

    await expect(getAdminAccess()).resolves.toEqual({ status: "signed-out" });
  });

  it("forbids users without the admin role", async () => {
    const session = sessionWithRole("user");
    sessionMock.mockResolvedValue(session);

    await expect(getAdminAccess()).resolves.toEqual({ status: "forbidden", session });
  });

  it("forbids users without any role", async () => {
    const session = sessionWithRole(null);
    sessionMock.mockResolvedValue(session);

    await expect(getAdminAccess()).resolves.toEqual({ status: "forbidden", session });
  });

  it("grants access to admins", async () => {
    const session = sessionWithRole("user,admin");
    sessionMock.mockResolvedValue(session);

    await expect(getAdminAccess()).resolves.toEqual({ status: "granted", session });
  });

  it("propagates API failures instead of treating the user as signed out", async () => {
    sessionMock.mockRejectedValue(new Error("Session lookup failed with HTTP 502"));

    await expect(getAdminAccess()).rejects.toThrow("HTTP 502");
  });
});
