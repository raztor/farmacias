/**
 * Options of every interactive transaction of the ordering flow. Payments wait on row locks
 * held by concurrent payments for the same products, so the defaults (2 s to get a connection,
 * 5 s to finish) are raised to stay safe under the concurrency tests and demo bursts.
 */
export const INTERACTIVE_TRANSACTION_OPTIONS = { maxWait: 10_000, timeout: 20_000 } as const;

/** Prisma error code for a unique constraint violation. */
const UNIQUE_VIOLATION = "P2002";

/** Detects Prisma's unique violation (structural: survives duplicated module instances). */
export const isUniqueViolationError = (error: unknown): boolean =>
  typeof error === "object" && error !== null && "code" in error && error.code === UNIQUE_VIOLATION;

/**
 * Runs `operation` and runs it once more if it failed on a unique constraint. Used for
 * "check, then insert" flows racing with an identical request (two first `addItem` calls
 * creating the draft, two payments with the same idempotency key): the retry observes the
 * row committed by the winner and takes the "already exists" path. The whole transaction is
 * retried, never a statement inside an aborted one.
 */
export const retryOnUniqueViolation = async <T>(operation: () => Promise<T>): Promise<T> => {
  try {
    return await operation();
  } catch (error) {
    if (!isUniqueViolationError(error)) throw error;
    return operation();
  }
};
