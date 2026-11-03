import { randomUUID } from "node:crypto";

import type { ApiSession } from "./api-session.ts";
import { isRecord, type JsonRecord } from "./trpc-http.ts";

/**
 * Domain helpers over the real API (no database access): tests create their own orders the
 * same way the apps do, and read stock and status back to assert side effects.
 */

const record = (value: unknown, what: string): JsonRecord => {
  if (!isRecord(value)) throw new Error(`Unexpected API payload for ${what}`);
  return value;
};

const str = (value: JsonRecord, key: string): string => {
  const item = value[key];
  if (typeof item !== "string") throw new Error(`Expected "${key}" to be a string`);
  return item;
};

const num = (value: JsonRecord, key: string): number => {
  const item = value[key];
  if (typeof item !== "number") throw new Error(`Expected "${key}" to be a number`);
  return item;
};

const list = (value: JsonRecord, key: string): JsonRecord[] => {
  const items = value[key];
  if (!Array.isArray(items)) throw new Error(`Expected "${key}" to be an array`);
  return items.map((item: unknown) => record(item, key));
};

export type Product = Readonly<{
  id: string;
  commercialName: string;
  activeIngredient: string;
  availableQty: number;
}>;

const toProduct = (value: JsonRecord): Product => ({
  id: str(value, "id"),
  commercialName: str(value, "commercialName"),
  activeIngredient: str(value, "activeIngredient"),
  availableQty: num(value, "availableQty"),
});

/**
 * Lanes of the active product list (by name) reserved for each spec. Every test adds its slot
 * (`projectSlot`: project index, plus the repeat index under `--repeat-each`), so tests that run
 * at the same time never share a product: one that discounts stock never disturbs another one
 * that asserts it. A lane holds 28 slots (14 projects with the branded browsers × up to 2
 * repetitions). The accessibility specs run in a single project each, so they add only their
 * repeat index to a sub-lane offset (0, 4, 8, 12). Every index stays below the number of
 * products with stock of the seed (172): `pickProduct` never wraps around onto another lane.
 */
export const PRODUCT_LANES = {
  residentHappyPath: 0,
  operatorFlow: 28,
  rejectedPayment: 56,
  deliveryValidation: 84,
  accessControl: 112,
  accessibility: 140,
} as const;

const PAGE_SIZE = 50;
const MAX_PAGES = 6;

/** Picks the product at `index` among the active products with at least `minQty` units. */
export async function pickProduct(
  api: ApiSession,
  options: Readonly<{ index: number; minQty?: number }>,
): Promise<Product> {
  const candidates: Product[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < MAX_PAGES && candidates.length <= options.index; page += 1) {
    const input = cursor === null ? { limit: PAGE_SIZE } : { limit: PAGE_SIZE, cursor };
    const result = record(await api.trpc.query("catalog.search", input), "search");
    const items = list(result, "items").map(toProduct);
    candidates.push(...items.filter((item) => item.availableQty >= (options.minQty ?? 5)));
    const next = result.nextCursor;
    cursor = typeof next === "string" ? next : null;
    if (cursor === null) break;
  }
  // No wrap-around: a modulo would silently hand this test another lane's product.
  const product = candidates[options.index];
  if (product === undefined) {
    throw new Error(
      `Only ${String(candidates.length)} products have ${String(options.minQty ?? 5)}+ units, ` +
        `so lane index ${String(options.index)} is out of range. Drop the E2E database: the ` +
        "next run re-creates and re-seeds it (docs/validation/e2e.md).",
    );
  }
  return product;
}

/** Units on hand of a product right now (public `catalog.byId`). */
export async function stockOf(api: ApiSession, productId: string): Promise<number> {
  return num(
    record(await api.trpc.query("catalog.byId", { id: productId }), "byId"),
    "availableQty",
  );
}

export type OrderRef = Readonly<{ id: string; code: string; status: string; version: number }>;

const toOrderRef = (value: unknown): OrderRef => {
  const order = record(value, "order");
  return {
    id: str(order, "id"),
    code: str(order, "code"),
    status: str(order, "status"),
    version: num(order, "version"),
  };
};

/** Adds a product to the resident's draft (creates the draft when there is none). */
export async function addToDraft(
  resident: ApiSession,
  productId: string,
  quantity: number,
): Promise<OrderRef> {
  return toOrderRef(await resident.trpc.mutation("orders.addItem", { productId, quantity }));
}

/** Draft with one line, pickup, confirmed: the order ends in «Pendiente de pago». */
export async function placePickupOrder(
  resident: ApiSession,
  productId: string,
  quantity = 1,
): Promise<OrderRef> {
  await addToDraft(resident, productId, quantity);
  const draft = toOrderRef(
    await resident.trpc.mutation("orders.setFulfillment", { type: "pickup" }),
  );
  return toOrderRef(
    await resident.trpc.mutation("orders.confirm", { expectedVersion: draft.version }),
  );
}

/** Simulated payment of the resident's own order with a fresh idempotency key. */
export async function payOrder(
  resident: ApiSession,
  orderId: string,
  scenario: "approve" | "reject",
): Promise<OrderRef> {
  const result = record(
    await resident.trpc.mutation("payments.pay", {
      orderId,
      idempotencyKey: randomUUID(),
      scenario,
    }),
    "payment",
  );
  return toOrderRef(result.order);
}

export type OrderDetail = OrderRef & Readonly<{ timeline: readonly string[] }>;

/** The resident's view of an order (`orders.detail`): status and timeline statuses, oldest first. */
export async function residentOrder(resident: ApiSession, id: string): Promise<OrderDetail> {
  const detail = record(await resident.trpc.query("orders.detail", { id }), "detail");
  return {
    ...toOrderRef(detail),
    timeline: list(detail, "timeline").map((entry) => str(entry, "status")),
  };
}

/** The back-office view of an order (`operations.order`): status and allowed transitions. */
export async function operationsOrder(
  operator: ApiSession,
  id: string,
): Promise<OrderRef & Readonly<{ allowedTransitions: readonly string[] }>> {
  const detail = record(await operator.trpc.query("operations.order", { id }), "operations");
  const allowed = detail.allowedTransitions;
  return {
    ...toOrderRef(detail),
    allowedTransitions: Array.isArray(allowed)
      ? allowed.filter((item: unknown) => typeof item === "string")
      : [],
  };
}
