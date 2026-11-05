import { isResident } from "@repo/shared";

/**
 * Session user as returned by Better Auth. `role` is added by the server's `admin` plugin, which
 * the client does not register, so it is read defensively.
 */
type SessionUser = object;

const roleOf = (user: SessionUser): unknown => ("role" in user ? user.role : undefined);

/**
 * Whether a signed-in user may use the resident app. The app is for residents only: operators
 * and admins work in the back office (`apps/admin`), and the API would answer FORBIDDEN to their
 * resident procedures anyway. Missing or unknown roles count as `resident` (`toRole`). Pure.
 */
export function canUseResidentApp(user: SessionUser | null | undefined): boolean {
  if (user === null || user === undefined) return false;
  return isResident(roleOf(user));
}
