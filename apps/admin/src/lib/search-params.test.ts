import { describe, expect, it } from "vitest";

import { compactSearch, readAll, readFirst, toSearch } from "./search-params";

describe("readAll", () => {
  it("reads single and repeated parameters, trimmed and without blanks", () => {
    expect(readAll({ status: " a " }, "status")).toEqual(["a"]);
    expect(readAll({ status: ["a", " ", "b"] }, "status")).toEqual(["a", "b"]);
    expect(readAll({}, "status")).toEqual([]);
  });
});

describe("readFirst", () => {
  it("returns the first non-blank value", () => {
    expect(readFirst({ q: ["", "x", "y"] }, "q")).toBe("x");
    expect(readFirst({ q: "  " }, "q")).toBeUndefined();
  });
});

describe("toSearch", () => {
  it("encodes ordered pairs and returns an empty string when empty", () => {
    expect(
      toSearch([
        ["status", "in_transit"],
        ["code", "P-1 2"],
      ]),
    ).toBe("?status=in_transit&code=P-1+2");
    expect(toSearch([])).toBe("");
  });
});

describe("compactSearch", () => {
  it("drops blank fields and trims values of a submitted form", () => {
    const form = new FormData();
    form.append("status", "payment_validated");
    form.append("status", "in_transit");
    form.append("fulfillment", "");
    form.append("code", " p-01 ");

    expect(compactSearch(form.entries())).toBe(
      "?status=payment_validated&status=in_transit&code=p-01",
    );
    expect(compactSearch(new FormData().entries())).toBe("");
  });

  it("ignores file fields", () => {
    expect(compactSearch([["file", new File(["x"], "a.txt")]])).toBe("");
  });
});
