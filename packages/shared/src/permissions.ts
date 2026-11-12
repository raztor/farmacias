import { toRole, type Role } from "./roles";

/**
 * Domain permissions (resource → actions). Together with {@link ROLE_PERMISSIONS} this is the
 * permission matrix of `docs/specs/auth.md`. `@repo/auth` registers it in the Better Auth
 * access control, next to the `admin` plugin's own `user`/`session` statements.
 *
 * The public catalog (search and product detail) needs no permission: anonymous visitors use it.
 */
export const PERMISSION_STATEMENTS = {
  /** Resident orders: draft cart, confirmation, simulated payment, own tracking. */
  order: ["create", "read-own", "pay", "cancel-own"],
  /** Back office: order queue, order detail and physical status transitions. */
  operations: ["read", "transition"],
  /** Account administration: list users and change their role. */
  users: ["list", "set-role"],
  /** Audit trail review. */
  audit: ["read"],
  /** Back-office stock: list, movements and low-stock alerts (read); receipts, adjustments and thresholds (adjust). */
  inventory: ["read", "adjust"],
  /** Catalog maintenance: create and edit products and prices (HU-11). */
  catalog: ["write"],
  /** Operational reports (HU-13). */
  reports: ["read"],
} as const;

export type PermissionStatements = typeof PERMISSION_STATEMENTS;
export type Resource = keyof PermissionStatements;
export type Action<R extends Resource> = PermissionStatements[R][number];

/** Actions granted to a role, per resource (missing resource = no access). */
export type RolePermissions = { readonly [R in Resource]?: readonly Action<R>[] };

/** Permission matrix per role (Inception v2.0 §4 actors, domain brief "Roles"). */
export const ROLE_PERMISSIONS = {
  resident: {
    order: ["create", "read-own", "pay", "cancel-own"],
  },
  operator: {
    operations: ["read", "transition"],
    inventory: ["read", "adjust"],
  },
  admin: {
    operations: ["read", "transition"],
    inventory: ["read", "adjust"],
    users: ["list", "set-role"],
    audit: ["read"],
    catalog: ["write"],
    reports: ["read"],
  },
} as const satisfies Record<Role, RolePermissions>;

/**
 * Whether a raw role value (normalized with {@link toRole}) is allowed to perform `action` on
 * `resource`. Pure: usable by the API, the clients (navigation) and tests.
 */
export const can = <R extends Resource>(role: unknown, resource: R, action: Action<R>): boolean => {
  const permissions: RolePermissions = ROLE_PERMISSIONS[toRole(role)];
  const actions: readonly string[] = permissions[resource] ?? [];
  return actions.includes(action);
};
