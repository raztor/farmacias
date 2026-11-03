import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";

import { authClient } from "./auth-client";
import { isUnauthorizedError, shouldRetryQuery } from "./retry-policy";

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
