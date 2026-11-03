import {
  ACTOR_ROLES,
  FULFILLMENT_TYPES,
  ORDER_STATUSES,
  isAppError,
  type ActorRole,
  type FulfillmentType,
  type OrderStatus,
} from "@repo/shared";
import { describe, expect, it } from "vitest";

import {
  allowedTransitions,
  assertTransition,
  canTransition,
  isPaidStatus,
  isPayableStatus,
  statusLabel,
  stockEffectOf,
} from "./index";

/**
 * Expected table, written independently from the implementation (docs/specs/order-status.md §4):
 * "from>to" → who may fire it. `owner` = resident owner, `staff` = operator/admin,
 * `system` = payment result. `pickup`/`delivery` restrict the fulfillment.
 */
const EXPECTED: Record<string, { who: readonly string[]; only?: FulfillmentType }> = {
  "draft>pending_payment": { who: ["owner"] }, // T1
  "pending_payment>payment_validated": { who: ["system"] }, // T2
  "pending_payment>payment_rejected": { who: ["system"] }, // T3
  "payment_rejected>payment_validated": { who: ["system"] }, // T4
  "payment_rejected>payment_rejected": { who: ["system"] }, // T5
  "payment_validated>in_preparation": { who: ["staff"] }, // T6
  "in_preparation>ready_for_pickup": { who: ["staff"], only: "pickup" }, // T7
  "in_preparation>in_transit": { who: ["staff"], only: "delivery" }, // T8
  "ready_for_pickup>delivered": { who: ["staff"] }, // T9
  "in_transit>delivered": { who: ["staff"] }, // T10
  "in_transit>not_delivered": { who: ["staff"] }, // T11
  "not_delivered>in_transit": { who: ["staff"] }, // T12
  "not_delivered>cancelled": { who: ["staff"] }, // T13
  "draft>cancelled": { who: ["owner", "staff"] }, // T14
  "pending_payment>cancelled": { who: ["owner", "staff"] }, // T15
  "payment_rejected>cancelled": { who: ["owner", "staff"] }, // T16
  "payment_validated>cancelled": { who: ["owner", "staff"] }, // T17
};

type Actor = { actorRole: ActorRole; isOwner: boolean };

const ACTORS: readonly Actor[] = ACTOR_ROLES.flatMap((actorRole) => [
  { actorRole, isOwner: true },
  { actorRole, isOwner: false },
]);

const kindOf = ({ actorRole, isOwner }: Actor): string | null => {
  if (actorRole === "system") return "system";
  if (actorRole === "operator" || actorRole === "admin") return "staff";
  return isOwner ? "owner" : null;
};

const expectedAllowed = (
  from: OrderStatus,
  to: OrderStatus,
  actor: Actor,
  fulfillment: FulfillmentType | null,
): boolean => {
  const rule = EXPECTED[`${from}>${to}`];
  const kind = kindOf(actor);
  if (!rule || kind === null || !rule.who.includes(kind)) return false;
  return rule.only === undefined || rule.only === fulfillment;
};

const FULFILLMENTS: readonly (FulfillmentType | null)[] = [...FULFILLMENT_TYPES, null];

const CASES = ORDER_STATUSES.flatMap((from) =>
  ORDER_STATUSES.flatMap((to) =>
    ACTORS.flatMap((actor) =>
      FULFILLMENTS.map((fulfillment) => ({
        from,
        to,
        fulfillment,
        ...actor,
        expected: expectedAllowed(from, to, actor, fulfillment),
      })),
    ),
  ),
);

describe("order status machine", () => {
  it("covers every status × destination × actor × fulfillment combination", () => {
    expect(CASES).toHaveLength(10 * 10 * 8 * 3);
    expect(CASES.filter((testCase) => testCase.expected).length).toBeGreaterThan(0);
  });

  it.each(CASES)(
    "$from → $to by $actorRole (owner=$isOwner, $fulfillment) allowed=$expected",
    ({ expected, ...query }) => {
      expect(canTransition(query)).toBe(expected);
    },
  );

  it("throws CONFLICT INVALID_TRANSITION with Spanish labels for an invalid transition", () => {
    const query = {
      from: "delivered",
      to: "in_preparation",
      actorRole: "operator",
      isOwner: false,
      fulfillment: "pickup",
    } as const;
    let caught: unknown;
    try {
      assertTransition(query);
    } catch (error) {
      caught = error;
    }
    expect(isAppError(caught)).toBe(true);
    expect(caught).toMatchObject({
      code: "CONFLICT",
      details: { reason: "INVALID_TRANSITION", from: "delivered", to: "in_preparation" },
    });
    expect((caught as Error).message).toContain("«Entregado» a «En preparación»");
  });

  it("does not throw for a valid transition", () => {
    expect(() => {
      assertTransition({
        from: "draft",
        to: "pending_payment",
        actorRole: "resident",
        isOwner: true,
        fulfillment: "pickup",
      });
    }).not.toThrow();
  });

  it("requires pickup for ready_for_pickup and delivery for in_transit", () => {
    const base = { from: "in_preparation", actorRole: "operator", isOwner: false } as const;
    expect(canTransition({ ...base, to: "ready_for_pickup", fulfillment: "pickup" })).toBe(true);
    expect(canTransition({ ...base, to: "ready_for_pickup", fulfillment: "delivery" })).toBe(false);
    expect(canTransition({ ...base, to: "in_transit", fulfillment: "delivery" })).toBe(true);
    expect(canTransition({ ...base, to: "in_transit", fulfillment: "pickup" })).toBe(false);
  });

  it("rejects a non-owner resident, staff on payment states and residents on physical states", () => {
    const stranger = { actorRole: "resident", isOwner: false, fulfillment: "pickup" } as const;
    expect(canTransition({ ...stranger, from: "draft", to: "cancelled" })).toBe(false);
    const staff = { actorRole: "admin", isOwner: false, fulfillment: "pickup" } as const;
    expect(canTransition({ ...staff, from: "pending_payment", to: "payment_validated" })).toBe(
      false,
    );
    const owner = { actorRole: "resident", isOwner: true, fulfillment: "pickup" } as const;
    expect(canTransition({ ...owner, from: "payment_validated", to: "in_preparation" })).toBe(
      false,
    );
    expect(canTransition({ ...owner, from: "pending_payment", to: "payment_validated" })).toBe(
      false,
    );
  });

  it("lists the allowed destinations per role and none for terminal statuses", () => {
    const staff = { actorRole: "operator", isOwner: false, fulfillment: "delivery" } as const;
    expect(allowedTransitions({ ...staff, status: "payment_validated" })).toEqual([
      "in_preparation",
      "cancelled",
    ]);
    expect(allowedTransitions({ ...staff, status: "in_preparation" })).toEqual(["in_transit"]);
    expect(allowedTransitions({ ...staff, status: "not_delivered" })).toEqual([
      "in_transit",
      "cancelled",
    ]);
    const owner = { actorRole: "resident", isOwner: true, fulfillment: "pickup" } as const;
    expect(allowedTransitions({ ...owner, status: "draft" })).toEqual([
      "pending_payment",
      "cancelled",
    ]);
    for (const actorRole of ACTOR_ROLES) {
      for (const status of ["delivered", "cancelled"] as const) {
        expect(
          allowedTransitions({ status, actorRole, isOwner: true, fulfillment: "pickup" }),
        ).toEqual([]);
      }
    }
  });

  it("labels the 10 statuses with the Inception names", () => {
    expect(ORDER_STATUSES.map(statusLabel)).toEqual([
      "Borrador",
      "Pendiente de pago",
      "Pago validado",
      "Pago rechazado",
      "En preparación",
      "Listo para retiro",
      "En ruta",
      "Entregado",
      "No entregado",
      "Cancelado",
    ]);
  });

  it("ties stock effects to transitions: discount on validation, restore only from paid", () => {
    expect(stockEffectOf("pending_payment", "payment_validated")).toBe("discount");
    expect(stockEffectOf("payment_rejected", "payment_validated")).toBe("discount");
    expect(stockEffectOf("payment_validated", "cancelled")).toBe("restore");
    expect(stockEffectOf("not_delivered", "cancelled")).toBe("none");
    expect(stockEffectOf("pending_payment", "cancelled")).toBe("none");
    expect(stockEffectOf("in_preparation", "ready_for_pickup")).toBe("none");
  });

  it("classifies payable and paid statuses", () => {
    expect(ORDER_STATUSES.filter(isPayableStatus)).toEqual(["pending_payment", "payment_rejected"]);
    expect(ORDER_STATUSES.filter(isPaidStatus)).toEqual([
      "payment_validated",
      "in_preparation",
      "ready_for_pickup",
      "in_transit",
      "delivered",
      "not_delivered",
    ]);
  });
});
