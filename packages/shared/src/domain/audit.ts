import { createOneOfGuard } from "./one-of";

/**
 * Audited actions of the Must scope (docs/specs/audit.md R-AUD-03). Stored in
 * `audit_logs.action`, guarded by the CHECK `audit_logs_action_check`: keep both in sync.
 */
export const AUDIT_ACTIONS = [
  "order.transition",
  "stock.sale",
  "stock.restore",
  "payment.stock_conflict",
  "user.role_change",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const isAuditAction = createOneOfGuard(AUDIT_ACTIONS);
