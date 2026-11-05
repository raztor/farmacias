import { describe, expect, it } from "vitest";

import {
  actorLabel,
  actorRoleLabel,
  formatClp,
  formatDateTime,
  fulfillmentLabel,
  statusLabel,
  unitsLabel,
} from "./orders-format";

describe("formatClp", () => {
  it("formats Chilean pesos without decimals", () => {
    expect(formatClp(12990)).toBe("$12.990");
    expect(formatClp(0)).toBe("$0");
  });
});

describe("formatDateTime", () => {
  it("shows the time in Chile whatever the viewer's time zone (summer, UTC-3)", () => {
    expect(formatDateTime(new Date("2026-01-15T12:30:00Z"))).toBe("15-01-2026, 09:30");
  });

  it("follows Chile's winter time (UTC-4)", () => {
    expect(formatDateTime(new Date("2026-07-15T12:30:00Z"))).toBe("15-07-2026, 08:30");
  });
});

describe("labels", () => {
  it("labels statuses and modalities in Spanish", () => {
    expect(statusLabel("ready_for_pickup")).toBe("Listo para retiro");
    expect(statusLabel("not_delivered")).toBe("No entregado");
    expect(fulfillmentLabel("pickup")).toBe("Retiro en farmacia");
    expect(fulfillmentLabel("delivery")).toBe("Despacho simulado");
    expect(fulfillmentLabel(null)).toBe("Sin modalidad");
  });

  it("labels actors, adding the name for internal use", () => {
    expect(actorRoleLabel("system")).toBe("Sistema");
    expect(actorRoleLabel("resident")).toBe("Persona inscrita");
    expect(actorLabel("operator", "Operador Demo")).toBe("Operario · Operador Demo");
    expect(actorLabel("system", null)).toBe("Sistema");
    expect(actorLabel("admin", " ")).toBe("Administrador");
  });

  it("pluralizes units", () => {
    expect(unitsLabel(1)).toBe("1 unidad");
    expect(unitsLabel(3)).toBe("3 unidades");
  });
});
