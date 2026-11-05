import {
  ACTOR_ROLES,
  AUDIT_ACTIONS,
  FULFILLMENT_TYPES,
  ORDER_STATUSES,
  PAYMENT_STATUSES,
  PRODUCT_CATEGORIES,
  STOCK_MOVEMENT_REASONS,
} from "@repo/shared";

/**
 * CHECK constraints that restrict a TEXT column to one of the `as const` lists of @repo/shared
 * (R-DAT-02), test-only module. The parity tests compare each list with the values the
 * database really accepts, so a value added on one side only fails CI.
 */
export const DOMAIN_CHECK_LISTS = [
  { constraint: "products_category_check", column: "category", values: PRODUCT_CATEGORIES },
  { constraint: "stock_movements_reason_check", column: "reason", values: STOCK_MOVEMENT_REASONS },
  { constraint: "orders_status_check", column: "status", values: ORDER_STATUSES },
  { constraint: "orders_fulfillment_check", column: "fulfillment", values: FULFILLMENT_TYPES },
  {
    constraint: "order_status_events_from_status_check",
    column: "from_status",
    values: ORDER_STATUSES,
  },
  {
    constraint: "order_status_events_to_status_check",
    column: "to_status",
    values: ORDER_STATUSES,
  },
  {
    constraint: "order_status_events_actor_role_check",
    column: "actor_role",
    values: ACTOR_ROLES,
  },
  { constraint: "payments_status_check", column: "status", values: PAYMENT_STATUSES },
  { constraint: "audit_logs_actor_role_check", column: "actor_role", values: ACTOR_ROLES },
  { constraint: "audit_logs_action_check", column: "action", values: AUDIT_ACTIONS },
] as const;

const QUOTED_LITERAL = /'([^']*)'/g;

/** Every single-quoted literal of a SQL fragment, in order. */
export function quotedLiterals(sql: string): string[] {
  return [...sql.matchAll(QUOTED_LITERAL)].map((match) => match[1] ?? "");
}

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Values of `"<column>" IN (...)` in the LAST definition of `constraint` in the migrations
 * (a later migration that drops and re-adds the constraint replaces the earlier list).
 * Returns `undefined` when the constraint or its IN list is missing.
 */
export function inListFromMigrations(
  sql: string,
  constraint: string,
  column: string,
): string[] | undefined {
  const pattern = new RegExp(
    `"${escapeRegExp(constraint)}" CHECK \\(.*?"${escapeRegExp(column)}" IN \\(([^)]*)\\)`,
    "g",
  );
  const definition = [...sql.matchAll(pattern)].at(-1)?.[1];
  return definition === undefined ? undefined : quotedLiterals(definition);
}
