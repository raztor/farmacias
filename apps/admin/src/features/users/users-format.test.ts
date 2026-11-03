import { ROLES } from "@repo/shared";
import { describe, expect, it } from "vitest";

import { formatUserDate, roleChangeMessage, roleLabel } from "./users-format";

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
