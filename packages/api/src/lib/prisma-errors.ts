/** Prisma error code for "record required by the operation was not found". */
const RECORD_NOT_FOUND = "P2025";

/**
 * Detects Prisma's "record not found" error (e.g. `update` on a missing id).
 * Structural on purpose: it does not load the Prisma runtime and survives duplicated
 * module instances.
 */
export const isRecordNotFoundError = (error: unknown): boolean =>
  typeof error === "object" && error !== null && "code" in error && error.code === RECORD_NOT_FOUND;
