import type { TimelineEntry } from "@repo/api";
import { ORDER_STATUSES } from "@repo/shared";
import { describe, expect, it } from "vitest";

import { actorLabel, canCancel, canPay, statusTone, toTimelineItems } from "./order-status-view";

const plain = (text: string) => text.replace(/\s/gu, " ");

describe("statusTone", () => {
  it("has a tone for every status", () => {
    for (const status of ORDER_STATUSES) expect(statusTone(status)).toBeTypeOf("string");
  });

  it("marks problems and finished states distinctly", () => {
    expect(statusTone("payment_rejected")).toBe("destructive");
    expect(statusTone("not_delivered")).toBe("destructive");
    expect(statusTone("delivered")).toBe("success");
    expect(statusTone("pending_payment")).toBe("warning");
  });
});

describe("canPay / canCancel", () => {
  it("allows paying only pending or rejected payments", () => {
    const payable = ORDER_STATUSES.filter(canPay);

    expect(payable).toEqual(["pending_payment", "payment_rejected"]);
  });

  it("allows the owner to cancel until the preparation starts", () => {
    const cancellable = ORDER_STATUSES.filter(canCancel);

    expect(cancellable).toEqual(["pending_payment", "payment_validated", "payment_rejected"]);
  });
});

describe("actorLabel (R-TRK-02)", () => {
  it("uses plain words and hides who in the pharmacy made the change", () => {
    expect(actorLabel("resident")).toBe("Tú");
    expect(actorLabel("system")).toBe("Sistema");
    expect(actorLabel("operator")).toBe("Farmacia");
    expect(actorLabel("admin")).toBe("Farmacia");
  });
});

describe("toTimelineItems (HU-09 #1)", () => {
  const entries: TimelineEntry[] = [
    {
      status: "payment_validated",
      label: "Pago validado",
      actorRole: "system",
      note: null,
      at: new Date("2026-11-03T13:41:00Z"),
    },
    {
      status: "pending_payment",
      label: "Pendiente de pago",
      actorRole: "resident",
      note: null,
      at: new Date("2026-11-03T13:40:00Z"),
    },
    {
      status: "in_preparation",
      label: "En preparación",
      actorRole: "operator",
      note: "Preparando en bodega",
      at: new Date("2026-11-03T14:05:00Z"),
    },
  ];

  it("lists the milestones in chronological order", () => {
    expect(toTimelineItems(entries).map((item) => item.title)).toEqual([
      "Pendiente de pago",
      "Pago validado",
      "En preparación",
    ]);
  });

  it("shows who and when, in Chile's time zone", () => {
    const [first, , last] = toTimelineItems(entries);

    expect(plain(first?.meta ?? "")).toBe("Tú · 3 nov 2026, 10:40");
    expect(plain(last?.meta ?? "")).toBe("Farmacia · 3 nov 2026, 11:05");
    expect(last?.note).toBe("Preparando en bodega");
  });

  it("marks only the last milestone as the current status", () => {
    expect(toTimelineItems(entries).map((item) => item.current)).toEqual([false, false, true]);
  });

  it("does not modify the input and handles an empty history", () => {
    const copy = [...entries];
    toTimelineItems(entries);

    expect(entries).toEqual(copy);
    expect(toTimelineItems([])).toEqual([]);
  });
});
