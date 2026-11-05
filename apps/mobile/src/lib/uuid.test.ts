import { describe, expect, it } from "vitest";

import { createUuidV4 } from "./uuid";

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

describe("createUuidV4", () => {
  it("returns an RFC 9562 version 4 UUID (accepted by the API's z.uuid())", () => {
    for (let attempt = 0; attempt < 50; attempt += 1) {
      expect(createUuidV4()).toMatch(UUID_V4);
    }
  });

  it("sets the version and variant bits on any random input", () => {
    expect(createUuidV4((length) => new Uint8Array(length).fill(0xff))).toBe(
      "ffffffff-ffff-4fff-bfff-ffffffffffff",
    );
    expect(createUuidV4((length) => new Uint8Array(length))).toBe(
      "00000000-0000-4000-8000-000000000000",
    );
  });

  it("generates a different key each time", () => {
    const keys = new Set(Array.from({ length: 200 }, () => createUuidV4()));

    expect(keys.size).toBe(200);
  });

  it("falls back to Math.random when Web Crypto is missing", () => {
    const original = globalThis.crypto;
    Object.defineProperty(globalThis, "crypto", { value: undefined, configurable: true });
    try {
      expect(createUuidV4()).toMatch(UUID_V4);
    } finally {
      Object.defineProperty(globalThis, "crypto", { value: original, configurable: true });
    }
  });
});
