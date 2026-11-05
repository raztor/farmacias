import { describe, expect, it } from "vitest";

import { transitionActionsFor } from "./transition-actions";
import {
  STALE_SELECTION_MESSAGE,
  resolveSelection,
  selectTransition,
} from "./transition-selection";

const pendingPayment = { version: 3, status: "pending_payment" as const };
const cancelOnly = transitionActionsFor(["cancelled"]);

describe("selectTransition", () => {
  it("snapshots the version and status the operator decided on", () => {
    expect(selectTransition(pendingPayment, "cancelled")).toEqual({
      to: "cancelled",
      version: 3,
      status: "pending_payment",
      submitted: false,
    });
  });
});

describe("resolveSelection", () => {
  it("shows the buttons when nothing is selected", () => {
    expect(resolveSelection(null, pendingPayment, cancelOnly)).toEqual({ kind: "idle" });
  });

  it("confirms the snapshot while the order is unchanged", () => {
    const selection = selectTransition(pendingPayment, "cancelled");

    expect(resolveSelection(selection, pendingPayment, cancelOnly)).toEqual({
      kind: "confirm",
      action: cancelOnly[0],
      selection,
    });
  });

  it("is stale when a refetch brings a newer version, even if the target is still allowed", () => {
    // Payment approved while «Cancelar pedido» was open: still cancellable, but no longer the
    // order the operator decided on (it would restore stock of a paid order).
    const selection = selectTransition(pendingPayment, "cancelled");
    const refetched = { version: 4, status: "payment_validated" as const };

    expect(resolveSelection(selection, refetched, cancelOnly)).toEqual({ kind: "stale" });
  });

  it("is stale (not silently gone) when the target is no longer allowed", () => {
    const selection = selectTransition(pendingPayment, "cancelled");

    expect(resolveSelection(selection, { version: 4 }, [])).toEqual({ kind: "stale" });
  });

  it("keeps a sent confirmation on screen while the API answers (its success bumps the version)", () => {
    const sent = { ...selectTransition(pendingPayment, "cancelled"), submitted: true };

    expect(resolveSelection(sent, { version: 4 }, [])).toEqual({
      kind: "confirm",
      action: cancelOnly[0],
      selection: sent,
    });
  });

  it("explains the change in Spanish", () => {
    expect(STALE_SELECTION_MESSAGE).toMatch(/^Este pedido cambió mientras lo revisabas\./);
  });
});
