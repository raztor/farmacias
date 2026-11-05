import { ORDER_STATUSES } from "@repo/shared";
import { describe, expect, it } from "vitest";

import {
  OPERATOR_TARGETS,
  QUEUE_STATUSES,
  isOperatorTarget,
  isQueueStatus,
  operationsOrderInput,
  queueInput,
  transitionInput,
} from "./operations.schema";

/** OPS-U01 (docs/specs/operations.md): queue filters and operator targets (R-OPS-01, R-OPS-06). */
describe("operations schemas", () => {
  describe("QUEUE_STATUSES", () => {
    it("is every order status except draft, in ORDER_STATUSES order", () => {
      expect(QUEUE_STATUSES).toEqual(ORDER_STATUSES.filter((status) => status !== "draft"));
      expect(ORDER_STATUSES.filter(isQueueStatus)).toEqual([...QUEUE_STATUSES]);
    });
  });

  describe("queueInput", () => {
    it("defaults to every non-draft status, no filters and 20 rows", () => {
      expect(queueInput.parse({})).toEqual({ limit: 20 });
    });

    it("accepts several statuses, a fulfillment and a cursor", () => {
      const parsed = queueInput.parse({
        status: ["in_preparation", "ready_for_pickup"],
        fulfillment: "pickup",
        cursor: "order-1",
        limit: 50,
      });
      expect(parsed).toEqual({
        status: ["in_preparation", "ready_for_pickup"],
        fulfillment: "pickup",
        cursor: "order-1",
        limit: 50,
      });
    });

    it("removes duplicate statuses and treats an empty list as no filter", () => {
      expect(queueInput.parse({ status: ["delivered", "delivered"] }).status).toEqual([
        "delivered",
      ]);
      expect(queueInput.parse({ status: [] }).status).toBeUndefined();
    });

    it.each([["draft"], ["unknown"]])("rejects the status %s (drafts are private)", (status) => {
      expect(queueInput.safeParse({ status: [status] }).success).toBe(false);
    });

    it("rejects an unknown fulfillment", () => {
      expect(queueInput.safeParse({ fulfillment: "drone" }).success).toBe(false);
    });

    it("upper-cases and trims the code search; blank means no search", () => {
      expect(queueInput.parse({ q: "  p-0001 " }).q).toBe("P-0001");
      expect(queueInput.parse({ q: "   " }).q).toBeUndefined();
    });

    it.each([["P-%"], ["P_1"], ["a".repeat(21)], ["P 1"]])(
      "rejects the code search %j (only letters, digits and dashes, 20 max)",
      (q) => {
        expect(queueInput.safeParse({ q }).success).toBe(false);
      },
    );

    it.each([[0], [101], [1.5]])("rejects limit %d", (limit) => {
      expect(queueInput.safeParse({ limit }).success).toBe(false);
    });
  });

  describe("operationsOrderInput", () => {
    it("requires a non-blank id", () => {
      expect(operationsOrderInput.parse({ id: " order-1 " })).toEqual({ id: "order-1" });
      expect(operationsOrderInput.safeParse({ id: "  " }).success).toBe(false);
    });
  });

  describe("transitionInput", () => {
    const base = { id: "order-1", expectedVersion: 3 };

    it.each(OPERATOR_TARGETS.map((to) => [to]))("accepts the operator target %s", (to) => {
      expect(transitionInput.parse({ ...base, to })).toEqual({ ...base, to, note: null });
    });

    it.each([["draft"], ["pending_payment"], ["payment_validated"], ["payment_rejected"]])(
      "rejects %s: resident and system transitions are not registered by operations",
      (to) => {
        const result = transitionInput.safeParse({ ...base, to });
        expect(result.success).toBe(false);
        expect(result.error?.issues[0]).toMatchObject({
          path: ["to"],
          message: "Ese cambio de estado no lo registra la operación",
        });
      },
    );

    it("keeps a trimmed note and stores a blank one as null", () => {
      const to = "in_preparation";
      expect(transitionInput.parse({ ...base, to, note: "  Caja 3 " }).note).toBe("Caja 3");
      expect(transitionInput.parse({ ...base, to, note: "   " }).note).toBeNull();
    });

    it("rejects a note longer than 200 characters", () => {
      const result = transitionInput.safeParse({ ...base, to: "delivered", note: "x".repeat(201) });
      expect(result.success).toBe(false);
    });

    it.each([[-1], [1.5], [undefined]])("rejects expectedVersion %j", (expectedVersion) => {
      const result = transitionInput.safeParse({ id: "o", to: "delivered", expectedVersion });
      expect(result.success).toBe(false);
    });
  });

  it("isOperatorTarget matches OPERATOR_TARGETS exactly", () => {
    expect(ORDER_STATUSES.filter(isOperatorTarget)).toEqual([...OPERATOR_TARGETS]);
  });
});
