/**
 * User roles (Inception v2.0 §4 "Actores"):
 * - `resident`: preregistered person ("persona inscrita"). Default role of every account.
 * - `operator`: authorized pharmacy/warehouse/delivery staff ("funcionario autorizado").
 * - `admin`: program administrator. Everything an operator can do plus users, roles and audit.
 */
export const ROLES = {
  resident: "resident",
  operator: "operator",
  admin: "admin",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

/** Every role as a tuple (least to most privileged), handy for `z.enum(ROLE_VALUES)`. */
export const ROLE_VALUES = [
  ROLES.resident,
  ROLES.operator,
  ROLES.admin,
] as const satisfies readonly Role[];

/** Role given to new accounts and to any missing or unknown role value. */
export const DEFAULT_ROLE = ROLES.resident;

/** Roles that work in the back office (operations queue and physical order transitions). */
export const OPERATIONAL_ROLES = [ROLES.operator, ROLES.admin] as const satisfies readonly Role[];

/** Spanish (Chile) labels for the UI. */
export const ROLE_LABELS = {
  resident: "Persona inscrita",
  operator: "Operario",
  admin: "Administrador",
} as const satisfies Record<Role, string>;

/** Privilege order used to resolve a list of roles to the effective one. */
const ROLE_RANK = { resident: 0, operator: 1, admin: 2 } as const satisfies Record<Role, number>;

/** Type guard for an exact role value (no normalization). */
export const isRole = (value: unknown): value is Role =>
  typeof value === "string" && (ROLE_VALUES as readonly string[]).includes(value);

/**
 * Effective role of a raw value from the database or the session payload.
 *
 * Better Auth's `admin` plugin stores roles as a comma-separated list ("resident,operator") and
 * grants a permission when any listed role has it, so the most privileged known role wins.
 * Missing or unknown values fall back to the least privileged role ({@link DEFAULT_ROLE}).
 */
export const toRole = (value: unknown): Role => {
  if (typeof value !== "string") return DEFAULT_ROLE;
  let effective: Role = DEFAULT_ROLE;
  for (const candidate of value.split(",")) {
    const role = candidate.trim();
    if (isRole(role) && ROLE_RANK[role] > ROLE_RANK[effective]) effective = role;
  }
  return effective;
};

/** `true` when the effective role is `resident` (the resident app and its procedures). */
export const isResident = (value: unknown): boolean => toRole(value) === ROLES.resident;

/** `true` for `operator` and `admin`: back-office access. */
export const isOperational = (value: unknown): boolean =>
  (OPERATIONAL_ROLES as readonly Role[]).includes(toRole(value));

/** `true` only for `admin`: users, roles and audit. */
export const isAdmin = (value: unknown): boolean => toRole(value) === ROLES.admin;
