import type { Prisma, PrismaClient } from "@repo/db";
import type { ActorRole, AuditAction } from "@repo/shared";

import {
  toActorRole,
  toAuditAction,
  type AuditEntityType,
  type AuditEntry,
  type ListAuditInput,
} from "./audit.schema";

/** Any Prisma client able to insert audit rows: the root client or a transaction client. */
export type AuditWriterClient = Pick<Prisma.TransactionClient, "auditLog">;

/** JSON snapshot stored in `before` / `after`: synthetic domain data only (R-AUD-05). */
export type AuditSnapshot = Prisma.InputJsonValue;

export type AuditEntryInput = {
  /** `null` for the system (e.g. a payment result). */
  actorId: string | null;
  actorRole: ActorRole;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  before?: AuditSnapshot | null;
  after?: AuditSnapshot | null;
};

/** Writes audit rows inside the caller's transaction (R-AUD-02). */
export type AuditWriter = {
  record: (entries: readonly AuditEntryInput[]) => Promise<void>;
};

const toRow = (entry: AuditEntryInput): Prisma.AuditLogCreateManyInput => ({
  actorId: entry.actorId,
  actorRole: entry.actorRole,
  action: entry.action,
  entityType: entry.entityType,
  entityId: entry.entityId,
  ...(entry.before == null ? {} : { before: entry.before }),
  ...(entry.after == null ? {} : { after: entry.after }),
});

/**
 * Audit writer bound to a client. Pass the transaction client (`tx`) so the rows commit or roll
 * back together with the audited change: there is never a committed change without its row.
 */
export const createAuditWriter = (client: AuditWriterClient): AuditWriter => ({
  record: async (entries) => {
    if (entries.length === 0) return;
    await client.auditLog.createMany({ data: entries.map(toRow) });
  },
});

export type AuditListQuery = Omit<ListAuditInput, "limit"> & { take: number };

export type AuditRepository = {
  /** Newest first (ties by id, stable for cursors). */
  list: (query: AuditListQuery) => Promise<AuditEntry[]>;
};

type AuditRow = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  actorRole: string;
  before: Prisma.JsonValue;
  after: Prisma.JsonValue;
  createdAt: Date;
  actor: { name: string } | null;
};

const toEntry = (row: AuditRow): AuditEntry => ({
  id: row.id,
  action: toAuditAction(row.action),
  entityType: row.entityType,
  entityId: row.entityId,
  actorRole: toActorRole(row.actorRole),
  actorName: row.actor?.name ?? null,
  before: row.before,
  after: row.after,
  createdAt: row.createdAt,
});

export const createAuditRepository = (db: PrismaClient): AuditRepository => ({
  list: async ({ take, cursor, entityType, entityId, action }) => {
    const rows = await db.auditLog.findMany({
      where: {
        ...(entityType ? { entityType } : {}),
        ...(entityId ? { entityId } : {}),
        ...(action ? { action } : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        actorRole: true,
        before: true,
        after: true,
        createdAt: true,
        actor: { select: { name: true } },
      },
    });
    return rows.map(toEntry);
  },
});
