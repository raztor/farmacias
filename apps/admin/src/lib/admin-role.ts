import { ROLES } from "@repo/shared";

/**
 * Whether a Better Auth role value grants backoffice access. The `admin` plugin stores roles as
 * a comma-separated list ("user,admin"), so any list containing `admin` counts (same rule as
 * the API's `adminProcedure`).
 */
export function isAdminRole(role: string | null | undefined): boolean {
  if (role === null || role === undefined || role === "") return false;
  return role.split(",").some((value) => value.trim() === ROLES.admin);
}
