import { describe, expect, it } from "vitest";

import {
  assertAuthSecret,
  AuthConfigError,
  MOBILE_TRUSTED_ORIGIN,
  normalizeBaseURL,
  normalizeTrustedOrigins,
} from "./auth-config";

describe("assertAuthSecret", () => {
  it("accepts secrets with 32 or more characters", () => {
    const secret = "a".repeat(32);

    expect(assertAuthSecret(secret)).toBe(secret);
  });

  it("rejects short or blank secrets", () => {
    expect(() => assertAuthSecret("a".repeat(31))).toThrow(AuthConfigError);
    expect(() => assertAuthSecret(" ".repeat(40))).toThrow(AuthConfigError);
  });
});

describe("normalizeBaseURL", () => {
  it("removes the trailing slash", () => {
    expect(normalizeBaseURL("https://api.example.cl/")).toBe("https://api.example.cl");
    expect(normalizeBaseURL("http://localhost:4000")).toBe("http://localhost:4000");
  });

  it("rejects invalid URLs and non-http protocols", () => {
    expect(() => normalizeBaseURL("not a url")).toThrow(AuthConfigError);
    expect(() => normalizeBaseURL("ftp://example.cl")).toThrow(AuthConfigError);
  });
});

describe("normalizeTrustedOrigins", () => {
  it("is the mobile scheme", () => {
    expect(MOBILE_TRUSTED_ORIGIN).toBe("bnp://");
  });

  it("trims, removes blanks and duplicates, and adds the mobile scheme", () => {
    const origins = normalizeTrustedOrigins([
      " http://localhost:8081 ",
      "",
      "http://localhost:8081",
      "https://*.example.cl",
    ]);

    expect(origins).toEqual(["http://localhost:8081", "https://*.example.cl", "bnp://"]);
  });

  it("does not duplicate the mobile scheme when already present", () => {
    expect(normalizeTrustedOrigins(["bnp://", "http://localhost:3001"])).toEqual([
      "bnp://",
      "http://localhost:3001",
    ]);
  });
});
