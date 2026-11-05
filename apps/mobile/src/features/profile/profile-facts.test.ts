import { describe, expect, it } from "vitest";

import { profileFacts } from "./profile-facts";

/** Intl may use non-breaking spaces; compare with plain ones. */
const plain = (text: string) => text.replace(/\s/gu, " ");

describe("profileFacts", () => {
  it("shows «Miembro desde» in Chile's time zone, not the device's (D-23)", () => {
    // 02:00 UTC on 1 January is still 31 December in Santiago (UTC-3).
    const facts = profileFacts({ role: "resident", createdAt: new Date("2026-01-01T02:00:00Z") });
    const memberSince = facts.find((fact) => fact.label === "Miembro desde");

    expect(plain(memberSince?.value ?? "")).toBe("31 dic 2025");
  });

  it("shows the role label", () => {
    const facts = profileFacts({ role: "resident", createdAt: new Date("2026-03-10T15:00:00Z") });

    expect(facts[0]).toEqual({ label: "Rol", value: "Persona inscrita" });
  });
});
