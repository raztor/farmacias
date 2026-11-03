import { describe, expect, it } from "vitest";

import { parseRouteId } from "./route-params";

describe("parseRouteId", () => {
  it("accepts a plain id", () => {
    expect(parseRouteId("cm123abc")).toBe("cm123abc");
    expect(parseRouteId(" cm123abc ")).toBe("cm123abc");
  });

  it.each([
    ["missing", undefined],
    ["empty", ""],
    ["repeated param", ["a", "b"]],
    ["too long", "x".repeat(65)],
    ["not a string", 7],
  ])("rejects a %s id", (_case, value) => {
    expect(parseRouteId(value)).toBeNull();
  });
});
