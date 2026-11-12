import { z } from "zod";

/**
 * Keyset cursors of the back-office stock lists. A cursor is an opaque string (the JSON of the
 * sort key of the last row of a page). It is validated on the way in, and the next page holds
 * the rows strictly after that key, so a row that stopped matching the filters, or disappeared,
 * never makes the next page skip a real row (Prisma's `cursor + skip: 1` would).
 * No Node globals: this module is part of the `AppRouter` type graph that clients compile.
 */

const CURSOR_MAX_LENGTH = 512;
export const INVALID_CURSOR_MESSAGE = "El cursor de paginación no es válido.";

const invalid = { error: INVALID_CURSOR_MESSAGE };

const jsonCursor = <T extends z.ZodType>(shape: T) =>
  z
    .string(invalid)
    .max(CURSOR_MAX_LENGTH, invalid)
    .transform((value, context): unknown => {
      try {
        return JSON.parse(value);
      } catch {
        // Not a cursor this API produced: a validation error, never a server error.
        context.addIssue({ code: "custom", message: INVALID_CURSOR_MESSAGE });
        return z.NEVER;
      }
    })
    .pipe(shape);

/** `inventory.list` order: product name, then product id. */
export const listCursorSchema = jsonCursor(
  z
    .tuple(
      [z.string(invalid).max(300, invalid), z.string(invalid).min(1, invalid).max(64, invalid)],
      invalid,
    )
    .transform(([name, productId]) => ({ name, productId })),
);
export type ListCursor = z.output<typeof listCursorSchema>;

/** `inventory.movements` order: newest first, then id. */
export const movementCursorSchema = jsonCursor(
  z
    .tuple([z.iso.datetime(invalid), z.string(invalid).min(1, invalid).max(64, invalid)], invalid)
    .transform(([createdAt, id]) => ({ createdAt: new Date(createdAt), id })),
);
export type MovementCursor = z.output<typeof movementCursorSchema>;

export const encodeListCursor = ({ name, productId }: ListCursor): string =>
  JSON.stringify([name, productId]);

export const encodeMovementCursor = ({ createdAt, id }: MovementCursor): string =>
  JSON.stringify([createdAt.toISOString(), id]);
