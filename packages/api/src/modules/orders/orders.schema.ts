import {
  ORDER_LINE_MAX_QUANTITY,
  ORDER_LINE_MIN_QUANTITY,
  type FulfillmentType,
  type OrderStatus,
} from "@repo/shared";
import { z } from "zod";

import type { RepeatChange } from "./repeat-plan";

/** Limits of the synthetic delivery data (docs/specs/orders.md R-ORD-09, D-04). */
export const DELIVERY_LIMITS = {
  sector: { min: 2, max: 60 },
  addressReference: { min: 3, max: 120 },
  contactAlias: { min: 2, max: 60 },
  instructions: { max: 200 },
} as const;

export const CANCEL_NOTE_MAX_LENGTH = 200;

const ID_MAX_LENGTH = 64;

const idSchema = (message: string) =>
  z.string({ error: message }).trim().min(1, { error: message }).max(ID_MAX_LENGTH, {
    error: message,
  });

const quantitySchema = z
  .number({ error: "Indica una cantidad" })
  .int({ error: "La cantidad debe ser un número entero" })
  .min(ORDER_LINE_MIN_QUANTITY, { error: "La cantidad mínima es 1" })
  .max(ORDER_LINE_MAX_QUANTITY, {
    error: `La cantidad máxima por producto es ${String(ORDER_LINE_MAX_QUANTITY)}`,
  });

const versionSchema = z.number({ error: "Falta la versión del pedido" }).int().min(0);

/** Required synthetic text: the same message when missing, blank or too short (HU-04 #2). */
const requiredText = (limits: { min: number; max: number }, message: string, tooLong: string) =>
  z
    .string({ error: message })
    .trim()
    .min(limits.min, { error: message })
    .max(limits.max, { error: tooLong });

/** Input of `orders.addItem`: the quantity is added to the line if the product is already in. */
export const addItemInput = z.object({
  productId: idSchema("Selecciona un producto"),
  quantity: quantitySchema,
});
export type AddItemInput = z.output<typeof addItemInput>;

/** Input of `orders.setQuantity`: replaces the quantity of an existing line. */
export const setQuantityInput = addItemInput;
export type SetQuantityInput = z.output<typeof setQuantityInput>;

/** Input of `orders.removeItem`. */
export const removeItemInput = z.object({ productId: idSchema("Selecciona un producto") });
export type RemoveItemInput = z.output<typeof removeItemInput>;

const pickupFulfillment = z.object({ type: z.literal("pickup") });

const deliveryFulfillment = z.object({
  type: z.literal("delivery"),
  sector: requiredText(
    DELIVERY_LIMITS.sector,
    "Indica el sector",
    "El sector admite hasta 60 caracteres",
  ),
  addressReference: requiredText(
    DELIVERY_LIMITS.addressReference,
    "Indica una referencia de dirección",
    "La referencia admite hasta 120 caracteres",
  ),
  contactAlias: requiredText(
    DELIVERY_LIMITS.contactAlias,
    "Indica un alias de contacto",
    "El alias admite hasta 60 caracteres",
  ),
  instructions: z
    .string()
    .trim()
    .max(DELIVERY_LIMITS.instructions.max, {
      error: "Las indicaciones admiten hasta 200 caracteres",
    })
    .optional()
    .transform((value) => (value === undefined || value.length === 0 ? null : value)),
});

/**
 * Input of `orders.setFulfillment` (HU-04): pickup asks for no address (#1); delivery requires
 * sector, address reference and contact alias, and a missing one is reported on its own field
 * in `data.zodError` (#2). Only synthetic data: no RUT, phone, email or real address (D-04).
 */
export const setFulfillmentInput = z.discriminatedUnion(
  "type",
  [pickupFulfillment, deliveryFulfillment],
  { error: "Elige retiro en farmacia o despacho simulado" },
);
export type SetFulfillmentInput = z.output<typeof setFulfillmentInput>;

/** Input of `orders.confirm`: the draft version the person reviewed. */
export const confirmInput = z.object({ expectedVersion: versionSchema });
export type ConfirmInput = z.output<typeof confirmInput>;

/** Input of `orders.cancel`. */
export const cancelInput = z.object({
  id: idSchema("Selecciona un pedido"),
  expectedVersion: versionSchema,
  note: z
    .string()
    .trim()
    .max(CANCEL_NOTE_MAX_LENGTH, { error: "La nota admite hasta 200 caracteres" })
    .optional(),
});
export type CancelInput = z.output<typeof cancelInput>;

/** Input of `orders.repeat` (HU-14): one of the caller's previous orders. */
export const repeatInput = z.object({ orderId: idSchema("Selecciona un pedido") });
export type RepeatInput = z.output<typeof repeatInput>;

export type DeliveryDetails = {
  sector: string;
  addressReference: string;
  contactAlias: string;
  instructions: string | null;
};

export type OrderDraftLine = {
  productId: string;
  commercialName: string;
  presentation: string;
  quantity: number;
  unitPriceClp: number;
  lineTotalClp: number;
  /** Units on hand right now (no reservation while in the draft, D-02). */
  availableQty: number;
};

/** The resident's cart (`orders.draft` and every draft mutation, R-ORD-05). */
export type OrderDraft = {
  id: string;
  code: string;
  status: "draft";
  fulfillment: FulfillmentType | null;
  delivery: DeliveryDetails | null;
  lines: OrderDraftLine[];
  itemCount: number;
  totalClp: number;
  version: number;
};

/** Order after a status change (`orders.confirm`, `orders.cancel`). */
export type OrderSummary = {
  id: string;
  code: string;
  status: OrderStatus;
  statusLabel: string;
  /** `null` only for a draft cancelled before choosing a fulfillment. */
  fulfillment: FulfillmentType | null;
  totalClp: number;
  version: number;
  updatedAt: Date;
};

/**
 * Result of `orders.repeat` (D-30): the cart after adding what was possible (`null` only when there
 * was no draft and nothing could be added) and every product not added in full.
 */
export type RepeatResult = { draft: OrderDraft | null; changes: RepeatChange[] };
