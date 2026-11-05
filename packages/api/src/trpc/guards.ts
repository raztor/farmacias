import { TRPCError } from "@trpc/server";
import type { AuthSession } from "@repo/auth";
import { isAdmin, isOperational, isResident, toRole, type Role } from "@repo/shared";

export const UNAUTHORIZED_MESSAGE = "Debes iniciar sesión para continuar.";
export const FORBIDDEN_MESSAGE = "No tienes permisos para realizar esta acción.";
export const IMPERSONATED_SESSION_MESSAGE =
  "Esta sesión actúa en nombre de otra cuenta y no puede usarse. Inicia sesión con tu propia cuenta.";

/**
 * Role requirement of each procedure kind (docs/specs/README.md "Roles y tipos de
 * procedimiento"). Every check runs on the server; hiding a button in a client is not security.
 */
export const ROLE_REQUIREMENTS = {
  /** `residentProcedure`: the resident app (cart, payment, own orders). */
  resident: isResident,
  /** `operatorProcedure`: back office (queue, physical transitions). Operator or admin. */
  operational: isOperational,
  /** `adminProcedure`: users, roles and audit. */
  admin: isAdmin,
} as const satisfies Record<string, (role: unknown) => boolean>;

export type RoleRequirement = keyof typeof ROLE_REQUIREMENTS;

/** Signed-in identity added to the context by `protectedProcedure`. */
export type Identity = {
  session: AuthSession;
  user: AuthSession["user"];
  /** Effective role (`toRole` of the stored value, least privileged when unknown). */
  role: Role;
};

/**
 * Throws UNAUTHORIZED without a session; otherwise returns the identity for the context.
 *
 * An impersonated session (`session.impersonatedBy` set by Better Auth's
 * `/admin/impersonate-user`) is refused with FORBIDDEN: it would let one account act as another,
 * and every status event and audit row would name the impersonated user as the actor (R-AUD-01,
 * RF-12, RNF-07). The endpoint is not reachable over HTTP (`AUTH_HTTP_PATHS`); this is defence in
 * depth (R-ACC-12).
 */
export const requireIdentity = (session: AuthSession | null): Identity => {
  if (!session) throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHORIZED_MESSAGE });
  if (session.session.impersonatedBy) {
    throw new TRPCError({ code: "FORBIDDEN", message: IMPERSONATED_SESSION_MESSAGE });
  }
  return { session, user: session.user, role: toRole(session.user.role) };
};

/** Throws FORBIDDEN when `role` does not meet `requirement`. */
export const requireRole = (role: Role, requirement: RoleRequirement): void => {
  if (!ROLE_REQUIREMENTS[requirement](role)) {
    throw new TRPCError({ code: "FORBIDDEN", message: FORBIDDEN_MESSAGE });
  }
};
