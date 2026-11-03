import type { PrismaClient } from "@repo/db";
import { toRole, type AuditAction, type Role } from "@repo/shared";

import type { AdminUser } from "./admin.schema";

export type ListUsersQuery = {
  /** Rows to fetch (callers ask for one extra row to detect the next page). */
  take: number;
  /** Id of the last row of the previous page. */
  cursor?: string | undefined;
  /** Case-insensitive "contains" match on email or name. */
  search?: string | undefined;
};

/** Role change requested by an administrator. */
export type RoleChange = {
  actorId: string;
  actorRole: Role;
  userId: string;
  role: Role;
};

export type RoleChangeResult = {
  user: AdminUser;
  previousRole: Role;
};

/** Audit action written for every role change (docs/specs/accounts-roles.md R-ACC-08). */
export const ROLE_CHANGE_AUDIT_ACTION = "user.role_change" satisfies AuditAction;

export type AdminRepository = {
  countUsers: (filter?: { createdSince?: Date }) => Promise<number>;
  countActiveSessions: (now: Date) => Promise<number>;
  /** Newest users first (ties broken by id, so the order is stable for cursors). */
  listUsers: (query: ListUsersQuery) => Promise<AdminUser[]>;
  /**
   * Changes the role and writes the `user.role_change` audit row in the same transaction.
   * Returns `null` when the user does not exist (nothing is written).
   */
  updateRole: (change: RoleChange) => Promise<RoleChangeResult | null>;
};

const ADMIN_USER_SELECT = {
  id: true,
  email: true,
  name: true,
  image: true,
  role: true,
  emailVerified: true,
  banned: true,
  createdAt: true,
} as const;

type AdminUserRow = Omit<AdminUser, "role" | "banned"> & {
  role: string | null;
  banned: boolean | null;
};

const toAdminUser = (row: AdminUserRow): AdminUser => ({
  ...row,
  role: toRole(row.role),
  banned: row.banned ?? false,
});

const searchFilter = (search: string | undefined) =>
  search
    ? {
        OR: [
          { email: { contains: search, mode: "insensitive" as const } },
          { name: { contains: search, mode: "insensitive" as const } },
        ],
      }
    : {};

export const createAdminRepository = (db: PrismaClient): AdminRepository => ({
  countUsers: (filter = {}) =>
    db.user.count({
      where: filter.createdSince ? { createdAt: { gte: filter.createdSince } } : {},
    }),

  countActiveSessions: (now) => db.session.count({ where: { expiresAt: { gt: now } } }),

  listUsers: async ({ take, cursor, search }) => {
    const rows = await db.user.findMany({
      where: searchFilter(search),
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: ADMIN_USER_SELECT,
    });
    return rows.map(toAdminUser);
  },

  updateRole: ({ actorId, actorRole, userId, role }) =>
    db.$transaction(async (tx) => {
      const current = await tx.user.findUnique({ where: { id: userId }, select: { role: true } });
      if (current === null) return null;
      const row = await tx.user.update({
        where: { id: userId },
        data: { role },
        select: ADMIN_USER_SELECT,
      });
      await tx.auditLog.create({
        data: {
          actorId,
          actorRole,
          action: ROLE_CHANGE_AUDIT_ACTION,
          entityType: "user",
          entityId: userId,
          before: { role: current.role },
          after: { role },
        },
      });
      return { user: toAdminUser(row), previousRole: toRole(current.role) };
    }),
});
