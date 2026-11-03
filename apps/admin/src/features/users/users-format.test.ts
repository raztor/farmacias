import { ROLES } from "@repo/shared";
import { describe, expect, it } from "vitest";

import { formatUserDate, roleChangeMessage, roleLabel } from "./users-format";

describe("roleLabel", () => {
  it("labels every role in Spanish", () => {
    expect(roleLabel(ROLES.admin)).toBe("Administrador");
    expect(roleLabel(ROLES.user)).toBe("Usuario");
  });
});

describe("formatUserDate", () => {
  it("uses the Chilean date format", () => {
    // Midday UTC: the same calendar day in every time zone from UTC-11 to UTC+11.
    expect(formatUserDate(new Date("2026-03-15T12:00:00Z"))).toBe("15-03-2026");
  });
});

describe("roleChangeMessage", () => {
  it("announces a promotion", () => {
    expect(roleChangeMessage("Ana", ROLES.admin)).toBe("Ana ahora es administrador.");
  });

  it("announces a demotion", () => {
    expect(roleChangeMessage("Ana", ROLES.user)).toBe("Ana ya no es administrador.");
  });
});
