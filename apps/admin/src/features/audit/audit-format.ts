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

const conflictText = (after: unknown): string => {
  const parsed = conflictSnapshot.safeParse(after);
  if (!parsed.success) return NO_DETAIL;
  const count = parsed.data.products.length;
  return count === 1
    ? "1 producto sin stock suficiente"
    : `${String(count)} productos sin stock suficiente`;
};

/**
 * One-line summary of what changed, in Spanish ("Pago validado → En preparación",
 * "Stock 10 → 8", "Persona inscrita → Operario"). Never prints raw JSON. Pure.
 */
export function describeAuditChange({ action, before, after }: AuditChangeSource): string {
  switch (action) {
    case "order.transition":
      return transitionText(statusText(before), statusText(after)) ?? NO_DETAIL;
    case "stock.sale":
    case "stock.restore": {
      const text = transitionText(stockText(before), stockText(after));
      return text === null ? NO_DETAIL : `Stock ${text}`;
    }
    case "user.role_change":
      return transitionText(roleText(before), roleText(after)) ?? NO_DETAIL;
    case "payment.stock_conflict":
      return conflictText(after);
  }
}
