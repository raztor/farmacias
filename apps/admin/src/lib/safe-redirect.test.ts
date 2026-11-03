import { describe, expect, it } from "vitest";

import {
  DEFAULT_AUTHENTICATED_PATH,
  SIGN_IN_PATH,
  safeRedirectPath,
  signInPathFor,
} from "./safe-redirect";

describe("safeRedirectPath", () => {
  it.each(["/", "/users", "/users?q=ana&page=2", "/users#top"])("accepts %s", (path) => {
    expect(safeRedirectPath(path)).toBe(path);
  });

  it.each([
    "//evil.example",
    "https://evil.example",
    "javascript:alert(1)",
    "/\\evil.example",
    "users",
    "",
  ])("rejects the open redirect %s", (path) => {
    expect(safeRedirectPath(path)).toBe(DEFAULT_AUTHENTICATED_PATH);
  });

  it("falls back when the value is missing", () => {
    expect(safeRedirectPath(null)).toBe(DEFAULT_AUTHENTICATED_PATH);
    expect(safeRedirectPath(undefined)).toBe(DEFAULT_AUTHENTICATED_PATH);
  });

  it("uses a custom fallback", () => {
    expect(safeRedirectPath("//evil.example", "/users")).toBe("/users");
  });
});

describe("signInPathFor", () => {
  it("returns the plain sign-in page for the home page", () => {
    expect(signInPathFor("/")).toBe(SIGN_IN_PATH);
  });

  it("encodes the protected path in redirectTo", () => {
    expect(signInPathFor("/users?q=ana")).toBe("/sign-in?redirectTo=%2Fusers%3Fq%3Dana");
  });

  it("round-trips through URLSearchParams", () => {
    const url = new URL(signInPathFor("/users?q=a&b=1"), "http://localhost");

    expect(url.searchParams.get("redirectTo")).toBe("/users?q=a&b=1");
  });
});
