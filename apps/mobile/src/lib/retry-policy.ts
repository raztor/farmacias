import { TRPCClientError } from "@trpc/client";

/**
 * Retries of a failing query after its first attempt. TanStack Query calls `retry` with the
 * number of failures before the current one (0 for the first failure).
 */
export const MAX_QUERY_RETRIES = 2;

/** HTTP statuses that will not change by retrying the same request. */
const NON_RETRYABLE_STATUSES: ReadonlySet<number> = new Set([400, 401, 403, 404, 409, 422]);

type TrpcErrorData = { code?: string; httpStatus?: number } | undefined;

function trpcErrorData(error: unknown): TrpcErrorData {
  return error instanceof TRPCClientError ? (error.data as TrpcErrorData) : undefined;
}

/**
 * TanStack Query `retry` policy: network failures and server errors are retried, client errors
 * (validation, auth, not found, conflicts) are not, since repeating the request cannot fix them.
 */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (failureCount >= MAX_QUERY_RETRIES) return false;
  const status = trpcErrorData(error)?.httpStatus;
  return status === undefined || !NON_RETRYABLE_STATUSES.has(status);
}

/** Whether the API rejected the request because the session is missing or expired. */
export function isUnauthorizedError(error: unknown): boolean {
  return trpcErrorData(error)?.code === "UNAUTHORIZED";
}
