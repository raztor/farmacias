import { describe, expect, it } from "vitest";

import {
  INVALID_CURSOR_MESSAGE,
  encodeListCursor,
  encodeMovementCursor,
  listCursorSchema,
  movementCursorSchema,
} from "./inventory-cursor";

describe("inventory keyset cursors", () => {
  it("round-trips the list sort key, accents included", () => {
    const cursor = { name: "Ácido Fólico Ñandú", productId: "p-1" };
    expect(listCursorSchema.parse(encodeListCursor(cursor))).toEqual(cursor);
  });

  it("round-trips the ledger sort key with millisecond precision", () => {
    const cursor = { createdAt: new Date("2026-11-11T10:20:30.123Z"), id: "m-1" };
    expect(movementCursorSchema.parse(encodeMovementCursor(cursor))).toEqual(cursor);
  });

  it.each([["p-1"], ["{"], ['["a"]'], ['["a", ""]'], [JSON.stringify(["x".repeat(600), "p"])]])(
    "rejects the list cursor %j with a validation message",
    (value) => {
      const result = listCursorSchema.safeParse(value);
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe(INVALID_CURSOR_MESSAGE);
    },
  );

  it("rejects a ledger cursor without a valid date", () => {
    const result = movementCursorSchema.safeParse('["ayer","m-1"]');
    expect(result.error?.issues[0]?.message).toBe(INVALID_CURSOR_MESSAGE);
  });
});
