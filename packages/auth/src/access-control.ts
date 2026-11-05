import { PERMISSION_STATEMENTS, ROLE_PERMISSIONS, ROLES } from "@repo/shared";
import { createAccessControl } from "better-auth/plugins/access";
import { defaultStatements } from "better-auth/plugins/admin/access";

/**
 * Better Auth access control: the `admin` plugin's own statements (`user`, `session`) plus the
 * domain permission matrix of `@repo/shared` (`order`, `operations`, `users`, `audit`).
 * Registering every role makes the admin-plugin endpoints and `auth.api.userHasPermission`
 * respect the same roles as the tRPC guards.
 */
export const accessControl = createAccessControl({
  ...defaultStatements,
  ...PERMISSION_STATEMENTS,
});

/**
 * The only Better Auth plugin permission an admin session holds: `user:create`, used by the E2E
 * setup to create throwaway residents (`POST /api/auth/admin/create-user`). Without
 * `user:set-role` the endpoint refuses any `role` (or `data.role`), so it can only create
 * `resident` accounts. Role changes go through the audited tRPC `admin.setRole` (R-ACC-08);
 * listing users through tRPC `admin.listUsers`.
 */
export const ADMIN_PLUGIN_PERMISSIONS = { user: ["create"] } as const;

/**
 * Roles registered in the `admin` plugin. Operators and residents get none of the
 * `user`/`session` statements, so the admin-plugin endpoints answer 403 to them. The other
 * endpoints are not even reachable over HTTP (`AUTH_HTTP_PATHS`).
 */
export const AUTH_ROLES = {
  [ROLES.resident]: accessControl.newRole({ ...ROLE_PERMISSIONS.resident }),
  [ROLES.operator]: accessControl.newRole({ ...ROLE_PERMISSIONS.operator }),
  [ROLES.admin]: accessControl.newRole({ ...ADMIN_PLUGIN_PERMISSIONS, ...ROLE_PERMISSIONS.admin }),
};
