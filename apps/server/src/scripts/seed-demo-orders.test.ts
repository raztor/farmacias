import { type AppLogger, noopLogger, type OrderStatus } from "@repo/shared";
import { describe, expect, it, vi } from "vitest";

import {
  DEMO_ORDER_SCENARIOS,
  DemoOrdersIncompleteError,
  demoActorsFrom,
  seedDemoOrders,
  type DemoOrderServices,
  type DemoOrderStore,
} from "./seed-demo-orders";

const PRODUCTS = ["p0", "p1", "p2", "p3", "p4", "p5", "p6", "p7"];
const RESIDENTS = ["r1", "r2", "r3"] as const;

type Transition = {
  orderId: string;
  to: OrderStatus;
  actor: { role: string };
  expectedVersion: number;
};

/** Records every service call and tracks a fake status/version per order. */
const recordingServices = () => {
  const calls: string[] = [];
  const state = { next: 0, orders: new Map<string, { status: OrderStatus; version: number }>() };
  const bump = (id: string, status: OrderStatus) => {
    const order = state.orders.get(id) ?? { status, version: 0 };
    const updated = { status, version: order.version + 1 };
    state.orders.set(id, updated);
    return {
      id,
      code: id,
      statusLabel: status,
      fulfillment: null,
      totalClp: 1,
      updatedAt: new Date(),
      ...updated,
    };
  };
  const services = {
    orders: {
      addItem: vi.fn(({ residentId, productId, quantity }) => {
        calls.push(`add ${residentId} ${productId} x${String(quantity)}`);
        return Promise.resolve({ version: 1 });
      }),
      setFulfillment: vi.fn(({ type }) => {
        calls.push(`fulfillment ${type}`);
        return Promise.resolve({ version: 2 });
      }),
      confirm: vi.fn(() => {
        state.next += 1;
        const id = `o${String(state.next)}`;
        calls.push(`confirm ${id}`);
        return Promise.resolve(bump(id, "pending_payment"));
      }),
      cancel: vi.fn(({ id, expectedVersion }: { id: string; expectedVersion: number }) => {
        calls.push(`cancel ${id} v${String(expectedVersion)}`);
        return Promise.resolve(bump(id, "cancelled"));
      }),
    },
    payments: {
      pay: vi.fn(({ orderId, scenario }: { orderId: string; scenario: string }) => {
        calls.push(`pay ${orderId} ${scenario}`);
        const order = bump(
          orderId,
          scenario === "approve" ? "payment_validated" : "payment_rejected",
        );
        return Promise.resolve({ order });
      }),
    },
    transitions: {
      transition: vi.fn((input: Transition) => {
        const { orderId, to, actor, expectedVersion } = input;
        calls.push(`${actor.role} ${orderId} → ${to} v${String(expectedVersion)}`);
        return Promise.resolve({ order: bump(orderId, to), restore: null });
      }),
    },
  } as unknown as DemoOrderServices;
  return { services, calls };
};

const store = (placed = 0, products = PRODUCTS, draftLines = 0): DemoOrderStore => ({
  countPlacedOrders: () => Promise.resolve(placed),
  countDraftLines: () => Promise.resolve(draftLines),
  pickProducts: () => Promise.resolve(products),
});

const run = (
  services: DemoOrderServices,
  demoStore: DemoOrderStore,
  logger: AppLogger = noopLogger,
) =>
  seedDemoOrders({ store: demoStore, services, residentIds: RESIDENTS, operatorId: "op", logger });

describe("seedDemoOrders", () => {
  it("creates every scenario through the services, in order, with fresh versions", async () => {
    const { services, calls } = recordingServices();

    const result = await seedDemoOrders({
      store: store(),
      services,
      residentIds: RESIDENTS,
      operatorId: "op",
      logger: noopLogger,
    });

    expect(result).toEqual({ created: DEMO_ORDER_SCENARIOS.length, skipped: false });
    expect(calls.slice(0, 9)).toEqual([
      "add r1 p0 x2",
      "add r1 p1 x1",
      "fulfillment pickup",
      "confirm o1",
      "pay o1 approve",
      "operator o1 → in_preparation v2",
      "operator o1 → ready_for_pickup v3",
      "operator o1 → delivered v4",
      "add r1 p2 x1",
    ]);
    expect(calls).toContain("pay o4 reject");
    expect(calls).toContain("operator o6 → not_delivered v4");
    expect(calls.at(-1)).toBe("cancel o8 v1");
  });

  it("uses synthetic delivery data only", async () => {
    const { services } = recordingServices();
    await seedDemoOrders({
      store: store(),
      services,
      residentIds: RESIDENTS,
      operatorId: "op",
      logger: noopLogger,
    });
    expect(services.orders.setFulfillment).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "delivery",
        sector: expect.stringContaining("sintético") as unknown,
      }),
    );
  });

  it("is idempotent: does nothing when every demo order already exists", async () => {
    const { services, calls } = recordingServices();
    const complete = DEMO_ORDER_SCENARIOS.length;

    await expect(run(services, store(complete))).resolves.toEqual({ created: 0, skipped: true });
    // Orders placed later through the apps only add to the count.
    await expect(run(services, store(complete + 2))).resolves.toEqual({
      created: 0,
      skipped: true,
    });
    expect(calls).toEqual([]);
  });

  it("fails loudly instead of skipping when a previous run left only some orders", async () => {
    const { services, calls } = recordingServices();

    await expect(run(services, store(3))).rejects.toThrow(DemoOrdersIncompleteError);
    await expect(run(services, store(3))).rejects.toThrow(/3 of 8 demo orders.*db:reset/);
    expect(calls).toEqual([]);
  });

  it("fails loudly when a failed run left lines in a demo resident's cart", async () => {
    const { services, calls } = recordingServices();

    await expect(run(services, store(0, PRODUCTS, 2))).rejects.toThrow(/2 cart lines.*db:reset/);
    expect(calls).toEqual([]);
  });

  it("logs how far it got and rethrows when a scenario fails", async () => {
    const { services } = recordingServices();
    const failure = new Error("stock conflict");
    vi.mocked(services.orders.confirm).mockImplementationOnce(() =>
      Promise.resolve({ id: "o1", version: 1, status: "pending_payment" } as never),
    );
    vi.mocked(services.orders.confirm).mockRejectedValueOnce(failure);
    const error = vi.fn();
    const logger: AppLogger = { ...noopLogger, error, child: () => logger };

    await expect(run(services, store(), logger)).rejects.toBe(failure);
    expect(error).toHaveBeenCalledWith(
      { err: failure, created: 1, expected: DEMO_ORDER_SCENARIOS.length },
      expect.stringMatching(/failed part-way.*db:reset/) as unknown,
    );
  });

  it("skips when the catalog lacks stocked products", async () => {
    const { services, calls } = recordingServices();
    const result = await seedDemoOrders({
      store: store(0, ["p0"]),
      services,
      residentIds: RESIDENTS,
      operatorId: "op",
      logger: noopLogger,
    });
    expect(result.skipped).toBe(true);
    expect(calls).toEqual([]);
  });
});

describe("demoActorsFrom", () => {
  it("picks the first three residents and the operator", () => {
    expect(
      demoActorsFrom([
        { id: "a", role: "resident" },
        { id: "b", role: "resident" },
        { id: "c", role: "resident" },
        { id: "d", role: "operator" },
        { id: "e", role: "admin" },
      ]),
    ).toEqual({ residentIds: ["a", "b", "c"], operatorId: "d" });
  });

  it("fails clearly when an account is missing", () => {
    expect(() => demoActorsFrom([{ id: "a", role: "resident" }])).toThrow(/three resident/);
  });
});
