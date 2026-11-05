import { describe, expect, it } from "vitest";

import {
  TRANSITION_NOTE_MAX_LENGTH,
  confirmationMessage,
  transitionActionsFor,
  transitionNoteSchema,
  transitionSuccessMessage,
} from "./transition-actions";

const targets = (allowed: Parameters<typeof transitionActionsFor>[0]) =>
  transitionActionsFor(allowed).map((action) => action.to);

describe("transitionActionsFor", () => {
  it("renders no button when the state machine allows nothing (e.g. delivered)", () => {
    expect(transitionActionsFor([])).toEqual([]);
  });

  it("renders exactly the allowed transitions, cancellation last", () => {
    expect(targets(["cancelled", "in_preparation"])).toEqual(["in_preparation", "cancelled"]);
    expect(targets(["not_delivered", "delivered"])).toEqual(["delivered", "not_delivered"]);
  });

  it("never offers a transition the API did not allow", () => {
    // payment_validated → only preparation or cancellation: no "delivered" shortcut (HU-08 #2).
    const actions = transitionActionsFor(["in_preparation", "cancelled"]);

    expect(actions.map((action) => action.to)).not.toContain("delivered");
    expect(actions).toHaveLength(2);
  });

  it("labels each action in Spanish and marks only cancellation as destructive", () => {
    expect(transitionActionsFor(["in_preparation", "cancelled"])).toEqual([
      { to: "in_preparation", label: "Iniciar preparación", destructive: false },
      { to: "cancelled", label: "Cancelar pedido", destructive: true },
    ]);
    expect(transitionActionsFor(["in_transit"])[0]?.label).toBe("Despachar (en ruta)");
  });
});

describe("confirmationMessage", () => {
  it("states the origin and destination statuses", () => {
    expect(confirmationMessage("P-000007", "in_preparation", "ready_for_pickup")).toBe(
      "El pedido P-000007 pasará de «En preparación» a «Listo para retiro».",
    );
  });

  it("explains the stock consequence of cancelling (R-OPS-11)", () => {
    expect(confirmationMessage("P-1", "payment_validated", "cancelled")).toMatch(
      /stock descontado por el pago se repondrá automáticamente/,
    );
    expect(confirmationMessage("P-1", "not_delivered", "cancelled")).toMatch(
      /stock no se repone automáticamente/,
    );
  });
});

describe("transitionSuccessMessage", () => {
  it("announces the new status", () => {
    expect(transitionSuccessMessage("P-000007", "delivered")).toBe(
      "Listo: el pedido P-000007 quedó en «Entregado».",
    );
  });
});

describe("transitionNoteSchema", () => {
  it("trims, treats blank as no note and caps the length", () => {
    expect(transitionNoteSchema.parse("  retira su hija  ")).toBe("retira su hija");
    expect(transitionNoteSchema.parse("   ")).toBeUndefined();
    expect(transitionNoteSchema.safeParse("a".repeat(TRANSITION_NOTE_MAX_LENGTH)).success).toBe(
      true,
    );
    expect(
      transitionNoteSchema.safeParse("a".repeat(TRANSITION_NOTE_MAX_LENGTH + 1)).error?.issues[0]
        ?.message,
    ).toBe("La nota admite hasta 200 caracteres.");
  });
});
