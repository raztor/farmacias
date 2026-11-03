import { isOperational, toRole, type Role } from "@repo/shared";

import { getServerSession, type ServerSession } from "./session";

export type AdminAccess =
  | Readonly<{ status: "signed-out" }>
  | Readonly<{ status: "forbidden"; session: ServerSession }>
  | Readonly<{ status: "granted"; session: ServerSession; role: Role }>;

/**
 * Back-office access of a session: only `operator` and `admin` get in; a `resident` (or any
 * unknown role, normalized to `resident`) is forbidden. Pure.
 */
export function resolveAdminAccess(session: ServerSession | null): AdminAccess {
  if (session === null) return { status: "signed-out" };
  if (!isOperational(session.user.role)) return { status: "forbidden", session };
  return { status: "granted", session, role: toRole(session.user.role) };
}

/**
 * Access level of the current request, verified against the API (not just the cookie).
 * Deduplicated per request through `getServerSession`'s cache. The API enforces the same rules
 * on every procedure (`operatorProcedure`, `adminProcedure`); this only decides what to render.
 */
export async function getAdminAccess(): Promise<AdminAccess> {
  return resolveAdminAccess(await getServerSession());
}
