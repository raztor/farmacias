import { paginationSchema, roleSchema, type Role } from "@repo/shared";
import { z } from "zod";

export const LIST_USERS_SEARCH_MAX_LENGTH = 100;

/**
 * Input of `admin.listUsers`: cursor pagination plus an optional email/name search.
 * A blank search (after trimming) means "no filter".
 */
export const listUsersInput = paginationSchema.extend({
  search: z
    .string()
    .trim()
    .max(LIST_USERS_SEARCH_MAX_LENGTH, { error: "La búsqueda es demasiado larga" })
    .optional(),
});
export type ListUsersInput = z.output<typeof listUsersInput>;

/** Input of `admin.setRole`. */
export const setRoleInput = z.object({
  userId: z.string().trim().min(1, { error: "Selecciona un usuario" }),
  role: roleSchema,
});
export type SetRoleInput = z.output<typeof setRoleInput>;

export type AdminStats = {
  totalUsers: number;
  newUsersLast7Days: number;
  /** Sessions that have not expired yet. */
  activeSessions: number;
};

/** User row shown in the backoffice. */
export type AdminUser = {
  id: string;
  email: string;
  name: string;
  image: string | null;
  role: Role;
  emailVerified: boolean;
  banned: boolean;
  createdAt: Date;
};

export type ListUsersResult = {
  items: AdminUser[];
  /** Pass it back as `cursor` to get the next page; `null` on the last page. */
  nextCursor: string | null;
};
