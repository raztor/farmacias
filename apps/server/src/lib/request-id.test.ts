import { describe, expect, it } from "vitest";

import { resolveRequestId } from "./request-id";

describe("resolveRequestId", () => {
  it("reuses a safe incoming id", () => {
    expect(resolveRequestId({ headers: { "x-request-id": "req_01:a.b-c" } })).toBe("req_01:a.b-c");
  });

  it("generates a UUID when the header is missing or unsafe", () => {
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
    expect(resolveRequestId({ headers: {} })).toMatch(uuid);
    expect(resolveRequestId({ headers: { "x-request-id": "a b" } })).toMatch(uuid);
    expect(resolveRequestId({ headers: { "x-request-id": "x".repeat(129) } })).toMatch(uuid);
  });
});
