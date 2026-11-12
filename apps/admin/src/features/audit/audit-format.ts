import {
  ORDER_STATUS_LABELS,
  ROLE_LABELS,
  isOrderStatus,
  isRole,
  type AuditAction,
} from "@repo/shared";
import { z } from "zod";

import type { AuditEntityOption } from "./audit-filters";

export const AUDIT_ACTION_LABELS: Readonly<Record<AuditAction, string>> = {
  "order.transition": "Cambio de estado de pedido",
  "stock.sale": "Descuento de stock por venta",
  "stock.restore": "Reposición de stock por cancelación",
  "payment.stock_conflict": "Pago aprobado sin stock suficiente",
  "user.role_change": "Cambio de rol",
  "stock.receipt": "Recepción de stock",
  "stock.adjustment": "Ajuste de stock",
  "inventory.threshold_change": "Cambio de umbral de stock bajo",
  "product.create": "Producto creado",
  "product.update": "Producto editado",
};

export const AUDIT_ENTITY_LABELS: Readonly<Record<AuditEntityOption, string>> = {
  order: "Pedido",
  product: "Producto",
  user: "Usuario",
};

/** Spanish label of an entity type (the raw value for an unexpected one). */
export function entityTypeLabel(entityType: string): string {
  return entityType in AUDIT_ENTITY_LABELS
    ? AUDIT_ENTITY_LABELS[entityType as AuditEntityOption]
    : entityType;
}

/** Snapshots written by each module (docs/specs/audit.md R-AUD-03). Unknown keys are ignored. */
const statusSnapshot = z.object({ status: z.string() });
const stockSnapshot = z.object({ onHand: z.number() });
const roleSnapshot = z.object({ role: z.string() });
const conflictSnapshot = z.object({ products: z.array(z.unknown()) });
const thresholdSnapshot = z.object({ lowStockThreshold: z.number() });
const productSnapshot = z.object({ priceClp: z.number() });

export type AuditChangeSource = Readonly<{ action: AuditAction; before: unknown; after: unknown }>;

const NO_DETAIL = "Sin detalle";
const ARROW = " → ";

const statusText = (value: unknown): string | null => {
  const parsed = statusSnapshot.safeParse(value);
  if (!parsed.success) return null;
  const { status } = parsed.data;
  return isOrderStatus(status) ? ORDER_STATUS_LABELS[status] : status;
};

const roleText = (value: unknown): string | null => {
  const parsed = roleSnapshot.safeParse(value);
  if (!parsed.success) return null;
  const { role } = parsed.data;
  return isRole(role) ? ROLE_LABELS[role] : role;
};

const stockText = (value: unknown): string | null => {
  const parsed = stockSnapshot.safeParse(value);
  return parsed.success ? String(parsed.data.onHand) : null;
};

/** "A → B", "→ B" (no previous value) or `null` when there is no new value. */
const transitionText = (before: string | null, after: string | null): string | null => {
  if (after === null) return null;
  return before === null ? `${ARROW.trim()} ${after}` : `${before}${ARROW}${after}`;
};

const thresholdText = (value: unknown): string | null => {
  const parsed = thresholdSnapshot.safeParse(value);
  return parsed.success ? String(parsed.data.lowStockThreshold) : null;
};

const CLP = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP" });

const priceText = (value: unknown): string | null => {
  const parsed = productSnapshot.safeParse(value);
  return parsed.success ? CLP.format(parsed.data.priceClp) : null;
};

/** "Precio $1.000 → $1.200" when the price changed, a generic text otherwise. */
const productUpdateText = (before: unknown, after: unknown): string => {
  const from = priceText(before);
  const to = priceText(after);
  return from !== null && to !== null && from !== to
    ? `Precio ${from}${ARROW}${to}`
    : "Datos del producto editados";
};

const conflictText = (after: unknown): string => {
  const parsed = conflictSnapshot.safeParse(after);
  if (!parsed.success) return NO_DETAIL;
  const count = parsed.data.products.length;
  return count === 1
    ? "1 producto sin stock suficiente"
    : `${String(count)} productos sin stock suficiente`;
};

type ChangeDescriber = (before: unknown, after: unknown) => string;

/** "<prefix> A → B" from two snapshots, or "Sin detalle" when there is no new value. */
const prefixed =
  (prefix: string, read: (value: unknown) => string | null): ChangeDescriber =>
  (before, after) => {
    const text = transitionText(read(before), read(after));
    return text === null ? NO_DETAIL : `${prefix} ${text}`;
  };

const stockChange = prefixed("Stock", stockText);

const DESCRIBERS: Readonly<Record<AuditAction, ChangeDescriber>> = {
  "order.transition": (before, after) =>
    transitionText(statusText(before), statusText(after)) ?? NO_DETAIL,
  "stock.sale": stockChange,
  "stock.restore": stockChange,
  "stock.receipt": stockChange,
  "stock.adjustment": stockChange,
  "user.role_change": (before, after) =>
    transitionText(roleText(before), roleText(after)) ?? NO_DETAIL,
  "payment.stock_conflict": (_before, after) => conflictText(after),
  "inventory.threshold_change": prefixed("Umbral", thresholdText),
  "product.create": () => "Producto creado",
  "product.update": productUpdateText,
};

/**
 * One-line summary of what changed, in Spanish ("Pago validado → En preparación",
 * "Stock 10 → 8", "Persona inscrita → Operario", "Precio $1.000 → $1.200"). Never prints raw
 * JSON. Pure.
 */
export function describeAuditChange({ action, before, after }: AuditChangeSource): string {
  return DESCRIBERS[action](before, after);
}
