import { randomUUID } from "node:crypto";

import type {
  InventoryItem,
  Order,
  OrderLine,
  Payment,
  PrismaClient,
  Product,
  User,
} from "@repo/db";
import {
  buildProductSearchText,
  type FulfillmentType,
  type OrderStatus,
  type PaymentStatus,
  type ProductCategory,
  type Role,
} from "@repo/shared";

/**
 * Factories for integration tests: they insert valid rows (every CHECK constraint satisfied)
 * with synthetic data and sensible defaults; override only what the test is about.
 */

const uniqueSuffix = (): string => randomUUID().slice(0, 8);

export type UserOverrides = { role?: Role; name?: string; email?: string };

/** A Better Auth `user` row (preregistered account) with the given role (default resident). */
export async function createUser(db: PrismaClient, overrides: UserOverrides = {}): Promise<User> {
  const suffix = uniqueSuffix();
  return db.user.create({
    data: {
      id: randomUUID(),
      name: overrides.name ?? `Persona Prueba ${suffix}`,
      email: overrides.email ?? `persona-${suffix}@demo.farmacia.cl`,
      emailVerified: true,
      role: overrides.role ?? "resident",
    },
  });
}

export type ProductOverrides = {
  sku?: string;
  commercialName?: string;
  activeIngredient?: string;
  presentation?: string;
  category?: ProductCategory;
  priceClp?: number;
  active?: boolean;
  /** Units on hand of the inventory row created with the product (default 10). */
  onHand?: number;
  lowStockThreshold?: number;
};

export type ProductWithInventory = Product & { inventory: InventoryItem };

/** A product plus its inventory row (`onHand` default 10, threshold default 5). */
export async function createProduct(
  db: PrismaClient,
  overrides: ProductOverrides = {},
): Promise<ProductWithInventory> {
  const suffix = uniqueSuffix();
  const names = {
    commercialName: overrides.commercialName ?? `Producto Prueba ${suffix}`,
    activeIngredient: overrides.activeIngredient ?? "Principio Activo",
    presentation: overrides.presentation ?? "Comprimidos x 30",
  };
  const product = await db.product.create({
    data: {
      ...names,
      sku: overrides.sku ?? `IT-${suffix.toUpperCase()}`,
      category: overrides.category ?? "otros",
      priceClp: overrides.priceClp ?? 1990,
      active: overrides.active ?? true,
      searchText: buildProductSearchText(names),
      inventory: {
        create: {
          onHand: overrides.onHand ?? 10,
          lowStockThreshold: overrides.lowStockThreshold ?? 5,
        },
      },
    },
    include: { inventory: true },
  });
  const { inventory } = product;
  if (!inventory) throw new Error("createProduct: the inventory row was not created");
  return { ...product, inventory };
}

/** Overwrites the units on hand of a product (test setup only; no stock movement row). */
export async function setStock(
  db: PrismaClient,
  productId: string,
  onHand: number,
): Promise<InventoryItem> {
  return db.inventoryItem.update({ where: { productId }, data: { onHand } });
}

export type OrderLineInput = { productId: string; quantity: number; unitPriceClp?: number };

export type OrderOverrides = {
  status?: OrderStatus;
  /** Defaults to "pickup" for any status other than draft/cancelled. */
  fulfillment?: FulfillmentType | null;
  lines?: readonly OrderLineInput[];
};

export type OrderWithLines = Order & { lines: OrderLine[] };

const SYNTHETIC_DELIVERY = {
  deliverySector: "Sector Prueba",
  deliveryAddressReference: "Pasaje Ficticio 123",
  deliveryContactAlias: "Contacto Prueba",
} as const;

function resolveFulfillment(overrides: OrderOverrides, status: OrderStatus) {
  if (overrides.fulfillment !== undefined) return overrides.fulfillment;
  return status === "draft" || status === "cancelled" ? null : "pickup";
}

/**
 * An order of `residentId` with its lines (unit price default 1990) and a server-side style
 * total. Default status "draft" (the cart: at most one per resident). Delivery orders get
 * synthetic delivery data. No status events, payments or stock movements are created.
 */
export async function createOrder(
  db: PrismaClient,
  residentId: string,
  overrides: OrderOverrides = {},
): Promise<OrderWithLines> {
  const status = overrides.status ?? "draft";
  const fulfillment = resolveFulfillment(overrides, status);
  const lines = (overrides.lines ?? []).map((line) => {
    const unitPriceClp = line.unitPriceClp ?? 1990;
    return { ...line, unitPriceClp, lineTotalClp: unitPriceClp * line.quantity };
  });
  return db.order.create({
    data: {
      residentId,
      status,
      fulfillment,
      ...(fulfillment === "delivery" ? SYNTHETIC_DELIVERY : {}),
      totalClp: lines.reduce((total, line) => total + line.lineTotalClp, 0),
      lines: { create: lines },
    },
    include: { lines: true },
  });
}

export type PaymentOverrides = {
  status?: PaymentStatus;
  idempotencyKey?: string;
  amountClp?: number;
  reference?: string | null;
  failureReason?: string | null;
};

/** A payment attempt of `order` (default approved, amount = order total or 1990). */
export async function createPayment(
  db: PrismaClient,
  order: Pick<Order, "id" | "totalClp">,
  overrides: PaymentOverrides = {},
): Promise<Payment> {
  return db.payment.create({
    data: {
      orderId: order.id,
      idempotencyKey: overrides.idempotencyKey ?? randomUUID(),
      amountClp: overrides.amountClp ?? (order.totalClp > 0 ? order.totalClp : 1990),
      status: overrides.status ?? "approved",
      reference: overrides.reference === undefined ? `SIM-${uniqueSuffix()}` : overrides.reference,
      failureReason: overrides.failureReason ?? null,
    },
  });
}
