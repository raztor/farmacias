import {
  FULFILLMENT_LABELS,
  ORDER_STATUS_LABELS,
  ROLE_LABELS,
  type ActorRole,
  type FulfillmentType,
  type OrderStatus,
} from "@repo/shared";

/** Dates are stored in UTC and always shown in Chile's time (R-AUD-07, D-23). */
export const DISPLAY_TIME_ZONE = "America/Santiago";

const clpFormatter = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

const dateTimeFormatter = new Intl.DateTimeFormat("es-CL", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: DISPLAY_TIME_ZONE,
});

/** Chilean pesos without decimals, e.g. `$12.990`. */
export function formatClp(amount: number): string {
  return clpFormatter.format(amount);
}

/** Date and 24-hour time in Chile, e.g. `15-03-2026, 09:30`. */
export function formatDateTime(date: Date): string {
  return dateTimeFormatter.format(date);
}

/** Spanish label of an order status (R-OST-01). */
export function statusLabel(status: OrderStatus): string {
  return ORDER_STATUS_LABELS[status];
}

/** Spanish label of the fulfillment; `null` is a cart cancelled before choosing one. */
export function fulfillmentLabel(fulfillment: FulfillmentType | null): string {
  return fulfillment === null ? "Sin modalidad" : FULFILLMENT_LABELS[fulfillment];
}

/** Spanish label of who made a change (`system` for automatic changes such as payments). */
export function actorRoleLabel(role: ActorRole): string {
  return role === "system" ? "Sistema" : ROLE_LABELS[role];
}

/** "Operario · Ana" (internal back-office use) or just the role when there is no name. */
export function actorLabel(role: ActorRole, name: string | null): string {
  const roleText = actorRoleLabel(role);
  return name === null || name.trim() === "" ? roleText : `${roleText} · ${name}`;
}

/** Units of an order, e.g. "1 unidad", "3 unidades". */
export function unitsLabel(count: number): string {
  return count === 1 ? "1 unidad" : `${String(count)} unidades`;
}
