import { TRPCClientError } from "@trpc/client";

/** Validation tree sent by the API in `data.zodError` (see `ApiErrorShape` of `@repo/api`). */
type ZodErrorTree = {
  errors?: string[];
  properties?: Record<string, ZodErrorTree | undefined>;
};

type ApiErrorData = {
  code?: string;
  httpStatus?: number;
  zodError?: ZodErrorTree | null;
  /** Domain discriminator (`AppError.details.reason`), when the API exposes it. */
  reason?: string;
};

function errorData(error: unknown): ApiErrorData | undefined {
  if (!(error instanceof TRPCClientError)) return undefined;
  return (error.data ?? undefined) as ApiErrorData | undefined;
}

/** tRPC error code (`CONFLICT`, `NOT_FOUND`…) or `undefined` for non-API errors. Pure. */
export function getApiErrorCode(error: unknown): string | undefined {
  return errorData(error)?.code;
}

/** Domain reason (`STOCK_CONFLICT`…) when the API sends one. Pure. */
export function getApiErrorReason(error: unknown): string | undefined {
  const reason = errorData(error)?.reason;
  return typeof reason === "string" ? reason : undefined;
}

/** Message written by the API (only meaningful for domain errors). */
export function getApiErrorText(error: unknown): string {
  return error instanceof Error ? error.message : "";
}

/**
 * First server validation message of each top-level input field (`data.zodError`), so a form can
 * point at the field that failed (HU-04 #2). Pure.
 */
export function getServerFieldErrors(error: unknown): Record<string, string> {
  const properties = errorData(error)?.zodError?.properties ?? {};
  const fieldErrors: Record<string, string> = {};
  for (const [field, tree] of Object.entries(properties)) {
    const message = tree?.errors?.[0];
    if (message !== undefined) fieldErrors[field] = message;
  }
  return fieldErrors;
}

const RETRYABLE_STATUSES: ReadonlySet<number> = new Set([408, 429]);

/**
 * Whether the server may or may not have processed a mutation: no response (network), a timeout,
 * rate limiting or a server error. Retrying must then reuse the same idempotency key. Pure.
 */
export function isOutcomeUnknown(error: unknown): boolean {
  if (!(error instanceof TRPCClientError)) return true;
  const status = errorData(error)?.httpStatus;
  if (status === undefined) return true;
  return status >= 500 || RETRYABLE_STATUSES.has(status);
}
