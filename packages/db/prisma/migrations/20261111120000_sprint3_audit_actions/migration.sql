-- HAND EDIT: audit actions of the Sprint 3 stories (docs/specs/audit.md R-AUD-03).
--
-- Stock receipts and adjustments (HU-10), low-stock thresholds (HU-12) and catalog maintenance
-- (HU-11) write audit rows with new actions. The CHECK must stay in sync with `AUDIT_ACTIONS`
-- in `@repo/shared`. Prisma does not model CHECK constraints, so `migrate diff` ignores it.

ALTER TABLE "audit_logs" DROP CONSTRAINT "audit_logs_action_check";

ALTER TABLE "audit_logs"
  ADD CONSTRAINT "audit_logs_action_check" CHECK ("action" IN (
    'order.transition',
    'stock.sale',
    'stock.restore',
    'payment.stock_conflict',
    'user.role_change',
    'stock.receipt',
    'stock.adjustment',
    'inventory.threshold_change',
    'product.create',
    'product.update'
  ));
