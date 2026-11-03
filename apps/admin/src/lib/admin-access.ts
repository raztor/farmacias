import { isAdminRole } from "./admin-role";
import { getServerSession, type ServerSession } from "./session";

export type AdminAccess =
  | Readonly<{ status: "signed-out" }>
  | Readonly<{ status: "forbidden"; session: ServerSession }>
  | Readonly<{ status: "granted"; session: ServerSession }>;

/**
 * Access level of the current request, verified against the API (not just the cookie).
 * Deduplicated per request through `getServerSession`'s cache.
 */
export async function getAdminAccess(): Promise<AdminAccess> {
  const session = await getServerSession();
  if (session === null) return { status: "signed-out" };
  if (!isAdminRole(session.user.role)) return { status: "forbidden", session };
  return { status: "granted", session };
}
