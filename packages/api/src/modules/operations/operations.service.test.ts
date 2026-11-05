import type { FulfillmentType, OrderStatus } from "@repo/shared";
import { beforeEach, describe, expect, it } from "vitest";

import { createInMemoryOperationsRepository } from "../../testing/in-memory-operations";
import { InMemoryOrdering } from "../../testing/in-memory-ordering";
import { QUEUE_STATUSES, queueInput, type QueueInput } from "./operations.schema";
import { createOperationsService, type OperationsActor } from "./operations.service";

const operator: OperationsActor = { id: "operator-1", role: "operator" };
const admin: OperationsActor = { id: "admin-1", role: "admin" };
const resident: OperationsActor = { id: "resident-1", role: "resident" };

const query = (input: Record<string, unknown> = {}): QueueInput => queueInput.parse(input);

/** OPS-U02, OPS-U03 (docs/specs/operations.md): queue and detail over fake repositories. */
describe("operations service: queue and detail", () => {
  let mem: InMemoryOrdering;
  let repo: ReturnType<typeof createInMemoryOperationsRepository>;
  const service = () => createOperationsService({ repo, runner: mem.transitionRunner() });

  const addOrder = (id: string, status: OrderStatus, fulfillment: FulfillmentType | null) =>
    mem.addOrder({ id, residentId: "resident-1", code: `P-${id}`, status, fulfillment });

  beforeEach(() => {
    mem = new InMemoryOrdering();
    repo = createInMemoryOperationsRepository(mem, { names: { "operator-1": "Operador Demo" } });
  });

  describe("queue (HU-07 #1)", () => {
    beforeEach(() => {
      addOrder("000001", "in_preparation", "pickup");
      addOrder("000002", "draft", null);
      addOrder("000003", "payment_validated", "delivery");
      addOrder("000004", "in_preparation", "delivery");
      addOrder("000005", "delivered", "pickup");
      addOrder("000010", "payment_validated", "pickup");
    });

    const codes = (result: { items: { code: string }[] }) => result.items.map((item) => item.code);

    it("excludes drafts by default and lists oldest first (FIFO)", async () => {
      const result = await service().queue(operator, query());
      expect(codes(result)).toEqual(["P-000001", "P-000003", "P-000004", "P-000005", "P-000010"]);
      expect(repo.queries[0]?.statuses).toEqual(QUEUE_STATUSES);
      expect(result.nextCursor).toBeNull();
    });

    it("shows only the orders matching every filter (status + fulfillment)", async () => {
      const result = await service().queue(
        admin,
        query({ status: ["in_preparation", "payment_validated"], fulfillment: "delivery" }),
      );
      expect(codes(result)).toEqual(["P-000003", "P-000004"]);
      expect(result.items.every((item) => item.fulfillment === "delivery")).toBe(true);
    });

    it("searches by exact code or prefix, case-insensitive", async () => {
      expect(codes(await service().queue(operator, query({ q: "p-000010" })))).toEqual([
        "P-000010",
      ]);
      expect(codes(await service().queue(operator, query({ q: "P-00000" })))).toEqual([
        "P-000001",
        "P-000003",
        "P-000004",
        "P-000005",
      ]);
      expect(codes(await service().queue(operator, query({ q: "P-000002" })))).toEqual([]);
    });

    it("paginates with an opaque cursor without repeating rows", async () => {
      const first = await service().queue(operator, query({ limit: 2 }));
      expect(codes(first)).toEqual(["P-000001", "P-000003"]);
      expect(first.nextCursor).toBe("000003");
      expect(repo.queries[0]?.take).toBe(3);

      const second = await service().queue(
        operator,
        query({ limit: 2, cursor: first.nextCursor ?? undefined }),
      );
      expect(codes(second)).toEqual(["P-000004", "P-000005"]);
      const third = await service().queue(
        operator,
        query({ limit: 2, cursor: second.nextCursor ?? undefined }),
      );
      expect(codes(third)).toEqual(["P-000010"]);
      expect(third.nextCursor).toBeNull();
    });

    it("keeps its place when the cursor order leaves the filter between pages", async () => {
      addOrder("000011", "payment_validated", "pickup");
      const filter = { limit: 2, status: ["payment_validated"] };
      const first = await service().queue(operator, query(filter));
      expect(codes(first)).toEqual(["P-000003", "P-000010"]);

      mem.order("000010").status = "in_preparation"; // another operator moved it
      const second = await service().queue(
        operator,
        query({ ...filter, cursor: first.nextCursor ?? undefined }),
      );

      expect(codes(second)).toEqual(["P-000011"]);
      expect(second.nextCursor).toBeNull();
    });

    it("returns no rows for a cursor that is not an order", async () => {
      const result = await service().queue(operator, query({ cursor: "missing" }));
      expect(result).toEqual({ items: [], nextCursor: null });
    });

    it("maps each row with a Spanish status label and the item count", async () => {
      mem.addProduct({ id: "p1" });
      mem.addLine({ orderId: "000001", productId: "p1", quantity: 3, unitPriceClp: 1000 });
      const [first] = (await service().queue(operator, query({ q: "P-000001" }))).items;
      expect(first).toMatchObject({
        status: "in_preparation",
        statusLabel: "En preparación",
        fulfillment: "pickup",
        itemCount: 3,
      });
    });

    it("rejects a non-operational caller with FORBIDDEN (defense in depth)", async () => {
      await expect(service().queue(resident, query())).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
      expect(repo.queries).toHaveLength(0);
    });
  });

  describe("order detail (R-OPS-05)", () => {
    it("returns lines, synthetic delivery data and history with labels and actor names", async () => {
      mem.addProduct({ id: "p1", commercialName: "Losartán", presentation: "50 mg x 30" });
      mem.addOrder({
        id: "o1",
        residentId: "resident-1",
        status: "in_transit",
        fulfillment: "delivery",
        version: 4,
        delivery: {
          sector: "Villa Sintética",
          addressReference: "Pasaje Ficticio 123",
          contactAlias: "Vecina Demo",
          instructions: null,
        },
      });
      mem.addLine({ orderId: "o1", productId: "p1", quantity: 2, unitPriceClp: 2500 });
      mem.state.events.push({
        orderId: "o1",
        from: "in_preparation",
        to: "in_transit",
        actorId: "operator-1",
        actorRole: "operator",
        note: "Sale en ruta 2",
      });

      const detail = await service().order(operator, "o1");

      expect(detail).toMatchObject({
        id: "o1",
        version: 4,
        statusLabel: "En ruta",
        lines: [{ productId: "p1", commercialName: "Losartán", quantity: 2, lineTotalClp: 5000 }],
        delivery: { sector: "Villa Sintética", contactAlias: "Vecina Demo" },
        history: [
          {
            fromStatus: "in_preparation",
            toStatus: "in_transit",
            toLabel: "En ruta",
            actorRole: "operator",
            actorName: "Operador Demo",
            note: "Sale en ruta 2",
          },
        ],
        allowedTransitions: ["delivered", "not_delivered"],
      });
    });

    it.each([["missing"], ["draft"]])("answers NOT_FOUND for a %s order", async (kind) => {
      addOrder("draft", "draft", null);
      await expect(service().order(operator, kind)).rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    it("rejects a non-operational caller with FORBIDDEN", async () => {
      addOrder("o1", "payment_validated", "pickup");
      await expect(service().order(resident, "o1")).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    // Allowed transitions per status and fulfillment, for both back-office roles (T6..T17).
    const ALLOWED: [OrderStatus, FulfillmentType, OrderStatus[]][] = [
      ["pending_payment", "pickup", ["cancelled"]],
      ["payment_rejected", "delivery", ["cancelled"]],
      ["payment_validated", "pickup", ["in_preparation", "cancelled"]],
      ["in_preparation", "pickup", ["ready_for_pickup"]],
      ["in_preparation", "delivery", ["in_transit"]],
      ["ready_for_pickup", "pickup", ["delivered"]],
      ["in_transit", "delivery", ["delivered", "not_delivered"]],
      ["not_delivered", "delivery", ["in_transit", "cancelled"]],
      ["delivered", "pickup", []],
      ["cancelled", "delivery", []],
    ];

    it.each(
      ALLOWED.flatMap(([status, fulfillment, allowed]) =>
        [operator, admin].map((actor) => [status, fulfillment, actor.role, allowed] as const),
      ),
    )("%s (%s) offers the right transitions to %s", async (status, fulfillment, role, allowed) => {
      addOrder("o1", status, fulfillment);
      const actor = role === "admin" ? admin : operator;
      expect((await service().order(actor, "o1")).allowedTransitions).toEqual(allowed);
    });
  });
});
