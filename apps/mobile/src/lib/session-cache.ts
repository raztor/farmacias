import type { QueryClient } from "@tanstack/react-query";
import { z } from "zod";

/**
 * Value of the Better Auth session atom (`authClient.$store.atoms.session`), which the library
 * types as `any`: only the fields this module needs are validated.
 */
const sessionAtomSchema = z.object({
  isPending: z.boolean(),
  data: z.object({ user: z.object({ id: z.string() }) }).nullable(),
});

/**
 * Signed-in user id from the session atom: `null` when signed out, `undefined` while it is still
 * unknown (first read pending) or the value is not a session. Pure.
 */
export function sessionUserId(value: unknown): string | null | undefined {
  const parsed = sessionAtomSchema.safeParse(value);
  if (!parsed.success || parsed.data.isPending) return undefined;
  return parsed.data.data?.user.id ?? null;
}

/**
 * tRPC query keys do not include the user, so cached carts and orders belong to whoever was
 * signed in when they were fetched. Whenever the signed-in user changes — another account, or no
 * account because the session expired or was revoked — every query is reset (data dropped,
 * mounted ones refetched with the new session), so the next resident on a shared device never
 * sees the previous one's data (HU-09 #2, D-10). The first known user only starts the tracking.
 */
export function createSessionCacheGuard(
  queryClient: Pick<QueryClient, "resetQueries">,
): (userId: string | null | undefined) => void {
  let current: string | null | undefined;
  return (userId) => {
    if (userId === undefined) return;
    const previous = current;
    current = userId;
    if (previous !== undefined && previous !== userId) void queryClient.resetQueries();
  };
}
