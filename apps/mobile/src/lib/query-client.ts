import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";

import { authClient } from "./auth-client";
import { isUnauthorizedError, shouldRetryQuery } from "./retry-policy";
import { createSessionCacheGuard, sessionUserId } from "./session-cache";

/**
 * The stored session can outlive the server session (expired or revoked). When the API answers
 * UNAUTHORIZED, refetch the session so the protected routes send the user back to sign-in.
 */
function onApiError(error: unknown): void {
  if (isUnauthorizedError(error)) authClient.$store.notify("$sessionSignal");
}

/** Creates the app-wide TanStack Query client with mobile-friendly defaults. */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    queryCache: new QueryCache({ onError: onApiError }),
    mutationCache: new MutationCache({ onError: onApiError }),
    defaultOptions: {
      queries: { staleTime: 30_000, retry: shouldRetryQuery },
      mutations: { retry: false },
    },
  });
}

/**
 * Resets the query cache whenever the signed-in user changes, however the session ended (sign-out,
 * expiry, revocation, another sign-in). It listens to the session store directly, so the reset
 * happens before React renders the next user's screens. Returns the unsubscribe function.
 */
export function watchSessionUser(queryClient: QueryClient): () => void {
  const guard = createSessionCacheGuard(queryClient);
  const sessionAtom = authClient.$store.atoms.session;
  if (sessionAtom === undefined) return () => undefined;
  return sessionAtom.subscribe((value: unknown) => {
    guard(sessionUserId(value));
  });
}
