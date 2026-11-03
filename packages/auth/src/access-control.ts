import { PERMISSION_STATEMENTS, ROLE_PERMISSIONS, ROLES } from "@repo/shared";
import { createAccessControl } from "better-auth/plugins/access";
import { adminAc, defaultStatements } from "better-auth/plugins/admin/access";

/**
 * Better Auth access control: the `admin` plugin's own statements (`user`, `session`) plus the
 * domain permission matrix of `@repo/shared` (`order`, `operations`, `users`, `audit`).
 * Registering every role makes the admin-plugin endpoints (`/admin/*`) and
 * `auth.api.userHasPermission` respect the same roles as the tRPC guards.
 */
export const accessControl = createAccessControl({
  ...defaultStatements,
  ...PERMISSION_STATEMENTS,
});

/**
 * Roles registered in the `admin` plugin. Only `admin` may use the account-management endpoints
 * (create, list, set-role, ban…): operators and residents get none of the `user`/`session`
 * statements, so `/admin/*` answers 403 to them.
 */
export const AUTH_ROLES = {
  [ROLES.resident]: accessControl.newRole({ ...ROLE_PERMISSIONS.resident }),
  [ROLES.operator]: accessControl.newRole({ ...ROLE_PERMISSIONS.operator }),
  [ROLES.admin]: accessControl.newRole({ ...adminAc.statements, ...ROLE_PERMISSIONS.admin }),
};
