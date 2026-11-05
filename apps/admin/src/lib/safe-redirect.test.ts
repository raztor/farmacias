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
    "/\t/evil.example",
    "/\n/evil.example",
    "/\r/evil.example",
    "/\t\t/evil.example/phish",
    "/users\u0000",
    "/users\u007f",
  ])("rejects the open redirect %j", (path) => {
    expect(safeRedirectPath(path)).toBe(DEFAULT_AUTHENTICATED_PATH);
  });

  it("rejects control characters decoded from the query string (%09, %0A, %0D)", () => {
    for (const encoded of ["%2F%09%2Fevil.example", "%2F%0A%2Fevil.example", "%2F%0D%2Fevil"]) {
      const value = new URLSearchParams(`redirectTo=${encoded}`).get("redirectTo");

      expect(safeRedirectPath(value)).toBe(DEFAULT_AUTHENTICATED_PATH);
    }
  });

  it("only returns paths that stay on the current origin once resolved", () => {
    const origin = "https://admin.farmacia.example.cl";
    const candidates = ["/users", "/./users?q=1", "/a/../users#x", "/\t/evil.example"];

    for (const candidate of candidates) {
      expect(new URL(safeRedirectPath(candidate), `${origin}/sign-in`).origin).toBe(origin);
    }
  });

  it.each([
    "/.//evil.example",
    "/..//evil.example/x",
    "/a/..//evil.example",
    "/%2e//evil.example",
    "/%2E%2E//evil.example",
    "/a/b/../..//evil.example?q=1#x",
  ])("rejects %j, which normalizes to a protocol-relative path", (path) => {
    expect(safeRedirectPath(path)).toBe(DEFAULT_AUTHENTICATED_PATH);
  });

  it("never returns a value that resolves to another origin", () => {
    const origin = "https://admin.farmacia.example.cl";
    const candidates = ["/.//evil.example", "/..//evil.example/x", "/%2e//evil.example", "/x"];

    for (const candidate of candidates) {
      const result = safeRedirectPath(candidate);

      expect(result.startsWith("//")).toBe(false);
      expect(new URL(result, `${origin}/sign-in`).origin).toBe(origin);
    }
  });

  it("returns the normalized path", () => {
    expect(safeRedirectPath("/a/../users?q=ana#top")).toBe("/users?q=ana#top");
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
