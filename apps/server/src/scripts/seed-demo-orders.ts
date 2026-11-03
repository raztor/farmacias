import { randomUUID } from "node:crypto";

import {
  createOrderTransitionServiceFromDeps,
  createOrdersServiceFromDeps,
  createPaymentsServiceFromDeps,
  type OrderTransitionService,
  type OrdersService,
  type PaymentsService,
  type TransitionActor,
} from "@repo/api";
import type { PrismaClient } from "@repo/db";
import type { AppLogger, OrderStatus } from "@repo/shared";

/**
 * Demo orders in several statuses for the back-office queue (synthetic data, RNF-06). They are
 * created THROUGH the real services (cart → confirm → simulated payment → operator transitions),
 * so status events, stock movements, payments and audit rows are as consistent as in real use.
 */

type ResidentSlot = 0 | 1 | 2;
type Step =
  | "approve"
  | "reject"
  | "cancel"
  | "in_preparation"
  | "ready_for_pickup"
  | "in_transit"
  | "delivered"
  | "not_delivered";

export type DemoOrderScenario = {
  resident: ResidentSlot;
  /** [product slot, quantity]: product slots index the picked demo products. */
  lines: readonly (readonly [number, number])[];
  fulfillment: "pickup" | "delivery";
  steps: readonly Step[];
};

export const DEMO_ORDER_SCENARIOS = [
  {
    resident: 0,
    lines: [
      [0, 2],
      [1, 1],
    ],
    fulfillment: "pickup",
    steps: ["approve", "in_preparation", "ready_for_pickup", "delivered"],
  },
  {
    resident: 0,
    lines: [[2, 1]],
    fulfillment: "delivery",
    steps: ["approve", "in_preparation", "in_transit"],
  },
  { resident: 1, lines: [[3, 3]], fulfillment: "pickup", steps: ["approve"] },
  {
    resident: 1,
    lines: [
      [4, 1],
      [5, 2],
    ],
    fulfillment: "delivery",
    steps: ["reject"],
  },
  { resident: 2, lines: [[6, 1]], fulfillment: "pickup", steps: [] },
  {
    resident: 2,
    lines: [[7, 2]],
    fulfillment: "delivery",
    steps: ["approve", "in_preparation", "in_transit", "not_delivered"],
  },
  {
    resident: 2,
    lines: [
      [0, 1],
      [3, 1],
    ],
    fulfillment: "pickup",
    steps: ["approve", "in_preparation"],
  },
  { resident: 0, lines: [[1, 1]], fulfillment: "pickup", steps: ["cancel"] },
] as const satisfies readonly DemoOrderScenario[];

export const DEMO_PRODUCT_COUNT = 8;

/** Synthetic delivery data only (D-04): no RUT, phone, email or real address. */
const DEMO_DELIVERY = {
  type: "delivery",
  sector: "Villa Demo (sector sintético)",
  addressReference: "Pasaje Ficticio 123, frente a la plaza",
  contactAlias: "Vecina Demo",
  instructions: "Dato de prueba",
} as const;

export type DemoOrderServices = {
  orders: Pick<OrdersService, "addItem" | "setFulfillment" | "confirm" | "cancel">;
  payments: Pick<PaymentsService, "pay">;
  transitions: Pick<OrderTransitionService, "transition">;
};

export type DemoOrderStore = {
  /** Orders past the draft owned by these residents (any means the demo already ran). */
  countPlacedOrders: (residentIds: readonly string[]) => Promise<number>;
  /** Ids of active products with plenty of stock, in a stable order. */
  pickProducts: (count: number) => Promise<string[]>;
};

export type SeedDemoOrdersOptions = {
  store: DemoOrderStore;
  services: DemoOrderServices;
  residentIds: readonly [string, string, string];
  operatorId: string;
  logger: AppLogger;
  scenarios?: readonly DemoOrderScenario[];
};

export type SeedDemoOrdersResult = { created: number; skipped: boolean };

type Placed = { orderId: string; version: number; status: OrderStatus };

const placeOrder = async (
  services: DemoOrderServices,
  residentId: string,
  scenario: DemoOrderScenario,
  productIds: readonly string[],
): Promise<Placed> => {
  for (const [slot, quantity] of scenario.lines) {
    const productId = productIds[slot];
    if (!productId) throw new Error(`Demo product slot ${String(slot)} is missing`);
    await services.orders.addItem({ residentId, productId, quantity });
  }
  const fulfillment =
    scenario.fulfillment === "pickup" ? { type: "pickup" as const } : DEMO_DELIVERY;
  const draft = await services.orders.setFulfillment({ residentId, ...fulfillment });
  const order = await services.orders.confirm({ residentId, expectedVersion: draft.version });
  return { orderId: order.id, version: order.version, status: order.status };
};

const applyStep = async (
  services: DemoOrderServices,
  context: { residentId: string; operator: TransitionActor },
  placed: Placed,
  step: Step,
): Promise<Placed> => {
  const { residentId, operator } = context;
  if (step === "approve" || step === "reject") {
    const result = await services.payments.pay({
      residentId,
      orderId: placed.orderId,
      idempotencyKey: randomUUID(),
      scenario: step,
    });
    return { ...placed, version: result.order.version, status: result.order.status };
  }
  if (step === "cancel") {
    const summary = await services.orders.cancel({
      residentId,
      id: placed.orderId,
      expectedVersion: placed.version,
      note: "Pedido de demostración cancelado por la persona",
    });
    return { ...placed, version: summary.version, status: summary.status };
  }
  const { order } = await services.transitions.transition({
    orderId: placed.orderId,
    to: step,
    actor: operator,
    expectedVersion: placed.version,
  });
  return { ...placed, version: order.version, status: order.status };
};

/**
 * Idempotent: when any demo resident already has a placed order, nothing is created (re-running
 * the seed never duplicates orders nor discounts stock again).
 */
export const seedDemoOrders = async ({
  store,
  services,
  residentIds,
  operatorId,
  logger,
  scenarios = DEMO_ORDER_SCENARIOS,
}: SeedDemoOrdersOptions): Promise<SeedDemoOrdersResult> => {
  if ((await store.countPlacedOrders(residentIds)) > 0) {
    logger.info({ skipped: true }, "Demo orders already present, skipping");
    return { created: 0, skipped: true };
  }
  const productIds = await store.pickProducts(DEMO_PRODUCT_COUNT);
  if (productIds.length < DEMO_PRODUCT_COUNT) {
    logger.warn({ found: productIds.length }, "Not enough stocked products for demo orders");
    return { created: 0, skipped: true };
  }
  const operator: TransitionActor = { id: operatorId, role: "operator" };
  for (const scenario of scenarios) {
    const residentId = residentIds[scenario.resident];
    let placed = await placeOrder(services, residentId, scenario, productIds);
    for (const step of scenario.steps) {
      placed = await applyStep(services, { residentId, operator }, placed, step);
    }
    logger.info({ orderId: placed.orderId, status: placed.status }, "Demo order created");
  }
  return { created: scenarios.length, skipped: false };
};

/** Minimum stock for a demo product, so the scenarios never hit a stock conflict. */
const DEMO_MIN_STOCK = 20;

export const createDemoOrderStore = (db: PrismaClient): DemoOrderStore => ({
  countPlacedOrders: (residentIds) =>
    db.order.count({ where: { residentId: { in: [...residentIds] }, status: { not: "draft" } } }),
  pickProducts: async (count) => {
    const rows = await db.product.findMany({
      where: { active: true, inventory: { onHand: { gte: DEMO_MIN_STOCK } } },
      orderBy: { sku: "asc" },
      take: count,
      select: { id: true },
    });
    return rows.map((row) => row.id);
  },
});

/** The ordering services of `@repo/api`, wired to Prisma (trusted server-side code). */
export const createDemoOrderServices = (
  db: PrismaClient,
  logger: AppLogger,
): DemoOrderServices => ({
  orders: createOrdersServiceFromDeps({ db }, logger),
  payments: createPaymentsServiceFromDeps({ db }, logger),
  transitions: createOrderTransitionServiceFromDeps({ db }),
});

export type DemoActors = { residentIds: [string, string, string]; operatorId: string };

/** First three residents and the first operator of the seeded accounts. */
export const demoActorsFrom = (accounts: readonly { id: string; role: string }[]): DemoActors => {
  const [first, second, third] = accounts.filter((account) => account.role === "resident");
  const operator = accounts.find((account) => account.role === "operator");
  if (!first || !second || !third || !operator) {
    throw new Error("Demo orders need three resident accounts and one operator account");
  }
  return { residentIds: [first.id, second.id, third.id], operatorId: operator.id };
};
