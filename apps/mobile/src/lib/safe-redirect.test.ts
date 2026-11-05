import { describe, expect, it } from "vitest";

import { DEFAULT_REDIRECT, safeRedirect, signInHref } from "./safe-redirect";

describe("safeRedirect", () => {
  it("accepts paths of this app", () => {
    expect(safeRedirect("/product/abc")).toBe("/product/abc");
    expect(safeRedirect("/cart")).toBe("/cart");
    expect(safeRedirect("/orders?tab=1")).toBe("/orders?tab=1");
  });

  it("takes the first value of a repeated search param", () => {
    expect(safeRedirect(["/cart", "/orders"])).toBe("/cart");
  });

  it.each([
    ["missing", undefined],
    ["not a string", 42],
    ["empty", "  "],
    ["relative", "cart"],
    ["protocol-relative", "//evil.example.com"],
    ["absolute URL", "https://evil.example.com"],
    ["embedded scheme", "/redirect?to=https://evil.example.com"],
    ["backslash", "/\\evil.example.com"],
    ["control character", "/cart\n"],
    ["control character inside", "/ca\trt"],
    ["the sign-in screen itself", "/sign-in"],
    ["the sign-in screen with params", "/sign-in?redirect=/cart"],
    ["too long", `/${"a".repeat(300)}`],
  ])("falls back to the catalog for %s", (_case, value) => {
    expect(safeRedirect(value)).toBe(DEFAULT_REDIRECT);
  });
});

describe("signInHref", () => {
  it("encodes where to come back after signing in", () => {
    expect(signInHref("/product/p 1")).toBe("/sign-in?redirect=%2Fproduct%2Fp%201");
  });

  it("never encodes an unsafe destination", () => {
    expect(signInHref("https://evil.example.com")).toBe("/sign-in?redirect=%2F");
  });
});
