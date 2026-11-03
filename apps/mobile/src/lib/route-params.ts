import { z } from "zod";

const ID_MAX_LENGTH = 64;

const routeIdSchema = z.string().trim().min(1).max(ID_MAX_LENGTH);

/**
 * Validates a dynamic route segment (`/order/[id]`): URLs are external input, so a missing,
 * repeated or oversized id is rejected before calling the API. Pure.
 */
export function parseRouteId(value: unknown): string | null {
  const result = routeIdSchema.safeParse(value);
  return result.success ? result.data : null;
}
