import { ROLES } from "@repo/shared";
import { describe, expect, it } from "vitest";

import {
  formatUserDate,
  pendingRoleChange,
  roleChangeMessage,
  roleChangePrompt,
  roleLabel,
} from "./users-format";

describe("roleLabel", () => {
  it("labels every role in Spanish", () => {
    expect(roleLabel(ROLES.resident)).toBe("Persona inscrita");
    expect(roleLabel(ROLES.operator)).toBe("Operario");
    expect(roleLabel(ROLES.admin)).toBe("Administrador");
  });
});

describe("formatUserDate", () => {
  it("uses the Chilean date format", () => {
    // Midday UTC: the same calendar day in every time zone from UTC-11 to UTC+11.
    expect(formatUserDate(new Date("2026-03-15T12:00:00Z"))).toBe("15-03-2026");
  });

  it("uses Chile's calendar day whatever the viewer's time zone (D-23)", () => {
    // 2026-03-15T02:00Z is 14-03 at 23:00 in Santiago (UTC-3, summer time).
    expect(formatUserDate(new Date("2026-03-15T02:00:00Z"))).toBe("14-03-2026");
    // 2026-07-01T03:30Z is 30-06 at 23:30 in Santiago (UTC-4, winter time).
    expect(formatUserDate(new Date("2026-07-01T03:30:00Z"))).toBe("30-06-2026");
  });
});

describe("pendingRoleChange", () => {
  it("returns the picked role only when it differs from the saved one", () => {
    expect(pendingRoleChange(ROLES.resident, ROLES.operator)).toBe(ROLES.operator);
    expect(pendingRoleChange(ROLES.resident, ROLES.resident)).toBeNull();
    expect(pendingRoleChange(ROLES.resident, null)).toBeNull();
    expect(pendingRoleChange(ROLES.resident, "superadmin")).toBeNull();
  });
});

describe("roleChangePrompt", () => {
  it("names the current and the new role", () => {
    expect(roleChangePrompt("Ana", ROLES.resident, ROLES.admin)).toBe(
      "¿Cambiar el rol de Ana de «Persona inscrita» a «Administrador»?",
    );
  });
});

describe("roleChangeMessage", () => {
  it.each([
    [ROLES.admin, "El rol de Ana ahora es «Administrador»."],
    [ROLES.operator, "El rol de Ana ahora es «Operario»."],
    [ROLES.resident, "El rol de Ana ahora es «Persona inscrita»."],
  ])("announces the new role %s", (role, expected) => {
    expect(roleChangeMessage("Ana", role)).toBe(expected);
  });
});
