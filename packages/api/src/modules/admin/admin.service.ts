import { AppError, noopLogger, ROLES, type AppLogger, type Role } from "@repo/shared";

import type { ApiDependencies } from "../../trpc";
import { createAdminRepository, type AdminRepository } from "./admin.repository";
import type {
  AdminStats,
  AdminUser,
  ListUsersInput,
  ListUsersResult,
  SetRoleInput,
} from "./admin.schema";

const DAY_MS = 24 * 60 * 60 * 1000;
export const NEW_USERS_WINDOW_DAYS = 7;

export type AdminServiceDeps = {
  repo: AdminRepository;
  logger?: AppLogger;
  /** Clock, injectable for tests. */
  now?: () => Date;
};

export type SetRoleCommand = SetRoleInput & {
  /** Id of the admin performing the change. */
  actorId: string;
  /** Effective role of the actor (always `admin` behind `adminProcedure`), for the audit row. */
  actorRole: Role;
};

export type AdminService = {
  stats: () => Promise<AdminStats>;
  listUsers: (input: ListUsersInput) => Promise<ListUsersResult>;
  setRole: (command: SetRoleCommand) => Promise<AdminUser>;
};

export const createAdminService = ({
  repo,
  logger = noopLogger,
  now = () => new Date(),
}: AdminServiceDeps): AdminService => ({
  stats: async () => {
    const current = now();
    const since = new Date(current.getTime() - NEW_USERS_WINDOW_DAYS * DAY_MS);
    const [totalUsers, newUsersLast7Days, activeSessions] = await Promise.all([
      repo.countUsers(),
      repo.countUsers({ createdSince: since }),
      repo.countActiveSessions(current),
    ]);
    return { totalUsers, newUsersLast7Days, activeSessions };
  },

  listUsers: async ({ cursor, limit, search }) => {
    const rows = await repo.listUsers({ take: limit + 1, cursor, search });
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    return { items, nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null };
  },

  setRole: async ({ actorId, actorRole, userId, role }) => {
    if (actorId === userId && role !== ROLES.admin) {
      throw new AppError("FORBIDDEN", "No puedes quitarte tu propio rol de administrador.");
    }
    const result = await repo.updateRole({ actorId, actorRole, userId, role });
    if (!result) throw new AppError("NOT_FOUND", "El usuario no existe.");
    logger.info({ actorId, userId, role, previousRole: result.previousRole }, "User role changed");
    return result.user;
  },
});

/** Wires the service to its Prisma repository and the request logger. */
export const createAdminServiceFromDeps = (
  deps: Pick<ApiDependencies, "db">,
  logger: AppLogger,
): AdminService => createAdminService({ repo: createAdminRepository(deps.db), logger });
