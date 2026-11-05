import { describe, expect, it } from "vitest";

import { toCorsOrigins } from "./origins";

describe("toCorsOrigins", () => {
  it("keeps exact origins and de-duplicates them", () => {
    expect(
      toCorsOrigins([" http://localhost:8081", "http://localhost:8081", "", "bnp://"]),
    ).toEqual(["http://localhost:8081", "bnp://"]);
  });

  it("turns wildcard subdomains into anchored single-label regexes", () => {
    const [matcher] = toCorsOrigins(["https://*.example.com"]);
    expect(matcher).toBeInstanceOf(RegExp);
    const regex = matcher as RegExp;
    expect(regex.test("https://app.example.com")).toBe(true);
    expect(regex.test("https://a.b.example.com")).toBe(false);
    expect(regex.test("https://app.example.com.evil.test")).toBe(false);
    expect(regex.test("https://appXexample.com")).toBe(false);
  });
});
