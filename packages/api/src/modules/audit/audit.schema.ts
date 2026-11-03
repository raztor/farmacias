import {
  AUDIT_ACTIONS,
  isActorRole,
  isAuditAction,
  paginationSchema,
  type ActorRole,
  type AuditAction,
} from "@repo/shared";
import { z } from "zod";

/** Entities that carry audit rows (docs/specs/audit.md R-AUD-03). */
export const AUDIT_ENTITY_TYPES = ["order", "product", "user"] as const;
export type AuditEntityType = (typeof AUDIT_ENTITY_TYPES)[number];

/** Input of `audit.list` (admin): filters by entity/action, newest first, cursor pagination. */
export const listAuditInput = paginationSchema.extend({
  entityType: z.enum(AUDIT_ENTITY_TYPES, { error: "Tipo de entidad desconocido" }).optional(),
  entityId: z.string().trim().min(1).max(64, { error: "Identificador demasiado largo" }).optional(),
  action: z.enum(AUDIT_ACTIONS, { error: "Acción desconocida" }).optional(),
});
export type ListAuditInput = z.output<typeof listAuditInput>;

/** One audit row as shown in the back office (admin only). */
export type AuditEntry = {
  id: string;
  action: AuditAction;
  entityType: string;
  entityId: string;
  actorRole: ActorRole;
  /** Display name of the actor (`null` for the system or a deleted user). Admin only. */
  actorName: string | null;
  before: unknown;
  after: unknown;
  createdAt: Date;
};

export type ListAuditResult = {
  items: AuditEntry[];
  nextCursor: string | null;
};

/** Narrows a stored actor role (TEXT guarded by a CHECK constraint) to the closed list. */
export const toActorRole = (value: string): ActorRole => (isActorRole(value) ? value : "system");

/**
 * Narrows a stored action (TEXT guarded by the CHECK `audit_logs_action_check`, so the fallback
 * is unreachable in practice) to the closed list.
 */
export const toAuditAction = (value: string): AuditAction =>
  isAuditAction(value) ? value : "order.transition";
