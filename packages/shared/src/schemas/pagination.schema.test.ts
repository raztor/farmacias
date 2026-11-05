import { describe, expect, it } from "vitest";

import { paginationSchema } from "./pagination.schema";

describe("paginationSchema", () => {
  it("defaults limit to 20 and leaves cursor optional", () => {
    expect(paginationSchema.parse({})).toEqual({ limit: 20 });
  });

  it("keeps a provided cursor and limit", () => {
    expect(paginationSchema.parse({ cursor: "abc", limit: 100 })).toEqual({
      cursor: "abc",
      limit: 100,
    });
  });

  it.each([0, 101, 1.5, "20"])("rejects limit %j", (limit) => {
    expect(paginationSchema.safeParse({ limit }).success).toBe(false);
  });

  it("rejects an empty cursor", () => {
    expect(paginationSchema.safeParse({ cursor: "" }).success).toBe(false);
  });
});
