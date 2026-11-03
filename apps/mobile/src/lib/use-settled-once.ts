import { useState } from "react";

/**
 * `true` once `isPending` has been `false` at least once, and forever after. Better Auth flips
 * `isPending` back to `true` while it refetches a missing session (e.g. right after signing in);
 * gating the navigator on the raw flag would unmount it and lose the current route.
 */
export function useSettledOnce(isPending: boolean): boolean {
  const [settled, setSettled] = useState(!isPending);
  if (!settled && !isPending) setSettled(true);
  return settled || !isPending;
}
