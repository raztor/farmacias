import { TRPCError } from "@trpc/server";
import { ROLE_VALUES } from "@repo/shared";
import { describe, expect, it } from "vitest";

import { createTestSession } from "../testing/fakes";
import {
  IMPERSONATED_SESSION_MESSAGE,
  ROLE_REQUIREMENTS,
  requireIdentity,
  requireRole,
  type RoleRequirement,
} from "./guards";

describe("requireIdentity", () => {
  it("rejects anonymous requests with UNAUTHORIZED", () => {
    expect(() => requireIdentity(null)).toThrow(TRPCError);
    expect(() => requireIdentity(null)).toThrow(expect.objectContaining({ code: "UNAUTHORIZED" }));
  });

  it("rejects an impersonated session with FORBIDDEN, whatever its role", () => {
    const resident = createTestSession({ id: "res-1", role: "resident" });
    const impersonated = {
      ...resident,
      session: { ...resident.session, impersonatedBy: "admin-1" },
    };

    expect(() => requireIdentity(impersonated)).toThrow(
      expect.objectContaining({ code: "FORBIDDEN", message: IMPERSONATED_SESSION_MESSAGE }),
    );
  });

  it("returns the session, the user and the effective role", () => {
    const session = createTestSession({ id: "op-1", role: "operator" });

    expect(requireIdentity(session)).toEqual({
      session,
      user: session.user,
      role: "operator",
    });
  });
});

describe("requireRole", () => {
  const EXPECTED: Record<RoleRequirement, readonly string[]> = {
    resident: ["resident"],
    operational: ["operator", "admin"],
    admin: ["admin"],
  };

  it.each(Object.keys(ROLE_REQUIREMENTS) as RoleRequirement[])(
    "%s procedures accept exactly the expected roles",
    (requirement) => {
      const allowed = ROLE_VALUES.filter((role) => {
        try {
          requireRole(role, requirement);
          return true;
        } catch (error) {
          expect(error).toMatchObject({ code: "FORBIDDEN" });
          return false;
        }
      });

      expect(allowed).toEqual(EXPECTED[requirement]);
    },
  );
});
