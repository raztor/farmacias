import type { PrismaClient } from "@repo/db";
import type { Role } from "@repo/shared";

import { isRecordNotFoundError } from "../../lib/prisma-errors";
import { toRole } from "../../lib/role";
import type { AdminUser } from "./admin.schema";

export type ListUsersQuery = {
  /** Rows to fetch (callers ask for one extra row to detect the next page). */
  take: number;
  /** Id of the last row of the previous page. */
  cursor?: string | undefined;
  /** Case-insensitive "contains" match on email or name. */
  search?: string | undefined;
};

export type AdminRepository = {
  countUsers: (filter?: { createdSince?: Date }) => Promise<number>;
  countActiveSessions: (now: Date) => Promise<number>;
  /** Newest users first (ties broken by id, so the order is stable for cursors). */
  listUsers: (query: ListUsersQuery) => Promise<AdminUser[]>;
  /** Returns `null` when the user does not exist. */
  updateRole: (userId: string, role: Role) => Promise<AdminUser | null>;
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

  updateRole: async (userId, role) => {
    try {
      const row = await db.user.update({
        where: { id: userId },
        data: { role },
        select: ADMIN_USER_SELECT,
      });
      return toAdminUser(row);
    } catch (error) {
      if (isRecordNotFoundError(error)) return null;
      throw error;
    }
  },
});
