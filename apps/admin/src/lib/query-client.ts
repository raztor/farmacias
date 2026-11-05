import {
  QueryClient,
  defaultShouldDehydrateQuery,
  environmentManager,
  type Query,
} from "@tanstack/react-query";
import { TRPCClientError } from "@trpc/client";
import superjson from "superjson";

const MAX_RETRIES = 3;
const STALE_TIME_MS = 30_000;

/** Client errors (4xx: unauthorized, validation, not found…) are not retried. */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof TRPCClientError) {
    const status = (error.data as { httpStatus?: unknown } | undefined)?.httpStatus;
    if (typeof status === "number" && status >= 400 && status < 500) return false;
  }
  return failureCount < MAX_RETRIES;
}

const shouldDehydrateQuery = (query: Query): boolean =>
  defaultShouldDehydrateQuery(query) || query.state.status === "pending";

/** New TanStack Query client with superjson (de)hydration, matching the tRPC transformer. */
export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: STALE_TIME_MS, retry: shouldRetry },
      mutations: { retry: false },
      dehydrate: { serializeData: superjson.serialize, shouldDehydrateQuery },
      hydrate: { deserializeData: superjson.deserialize },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

/**
 * A fresh client per server request (no data shared between users) and a singleton in the
 * browser (so React suspending during the initial render does not drop the cache).
 */
export function getQueryClient(): QueryClient {
  if (environmentManager.isServer()) return makeQueryClient();
  browserQueryClient ??= makeQueryClient();
  return browserQueryClient;
}
