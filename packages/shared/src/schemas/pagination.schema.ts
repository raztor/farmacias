import { z } from "zod";

export const PAGINATION_DEFAULT_LIMIT = 20;
export const PAGINATION_MAX_LIMIT = 100;

/** Cursor-based pagination input shared by list endpoints. */
export const paginationSchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.number().int().min(1).max(PAGINATION_MAX_LIMIT).default(PAGINATION_DEFAULT_LIMIT),
});

/** What callers send (`limit` optional). */
export type PaginationInput = z.input<typeof paginationSchema>;
/** What handlers receive after parsing (`limit` always set). */
export type Pagination = z.output<typeof paginationSchema>;
