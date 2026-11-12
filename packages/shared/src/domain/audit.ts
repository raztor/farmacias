import { createOneOfGuard } from "./one-of";

/**
 * Audited actions (docs/specs/audit.md R-AUD-03): the Must scope plus the Sprint 3 stories
 * (stock receipts/adjustments and thresholds HU-10/HU-12, catalog maintenance HU-11). Stored in
 * `audit_logs.action`, guarded by the CHECK `audit_logs_action_check`: keep both in sync.
 */
export const AUDIT_ACTIONS = [
  "order.transition",
  "stock.sale",
  "stock.restore",
  "payment.stock_conflict",
  "user.role_change",
  "stock.receipt",
  "stock.adjustment",
  "inventory.threshold_change",
  "product.create",
  "product.update",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const isAuditAction = createOneOfGuard(AUDIT_ACTIONS);
