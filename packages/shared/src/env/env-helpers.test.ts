import { describe, expect, it } from "vitest";

import { zBooleanString, zCommaList } from "./env-helpers";

describe("zBooleanString", () => {
  it.each([
    ["true", true],
    ["TRUE", true],
    ["1", true],
    ["false", false],
    ["False", false],
    ["0", false],
  ])("parses %s as %s", (input, expected) => {
    expect(zBooleanString.parse(input)).toBe(expected);
  });

  it.each(["yes", "", "2", "on"])("rejects %j", (input) => {
    expect(zBooleanString.safeParse(input).success).toBe(false);
  });

  it("supports defaults when the variable is missing", () => {
    expect(zBooleanString.default(true).parse(undefined)).toBe(true);
  });
});

describe("zCommaList", () => {
  it("splits, trims and drops empty items", () => {
    expect(zCommaList.parse(" a , b,,c ,")).toEqual(["a", "b", "c"]);
  });

  it("returns an empty list for an empty string", () => {
    expect(zCommaList.parse("")).toEqual([]);
  });

  it("rejects non-string input", () => {
    expect(zCommaList.safeParse(undefined).success).toBe(false);
  });
});
