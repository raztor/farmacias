import { ROLES, type Role } from "@repo/shared";

/**
 * Normalizes a role coming from the database or the session payload.
 *
 * Better Auth's `admin` plugin stores roles as a comma-separated string ("user,admin"),
 * so any list that contains `admin` is an admin. Unknown or missing values fall back
 * to the least privileged role.
 */
export const toRole = (value: string | null | undefined): Role => {
  if (!value) return ROLES.user;
  const roles = value.split(",").map((role) => role.trim());
  return roles.includes(ROLES.admin) ? ROLES.admin : ROLES.user;
};

export const isAdminRole = (value: string | null | undefined): boolean =>
  toRole(value) === ROLES.admin;
