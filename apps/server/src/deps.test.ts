import { describe, expect, it } from "vitest";

import { toTrustProxySetting } from "./deps";

describe("toTrustProxySetting", () => {
  it("uses the hop count when no proxy address is listed", () => {
    expect(toTrustProxySetting({ TRUST_PROXY_HOPS: 2, TRUST_PROXY_ADDRESSES: undefined })).toBe(2);
    expect(toTrustProxySetting({ TRUST_PROXY_HOPS: 1, TRUST_PROXY_ADDRESSES: [] })).toBe(1);
  });

  it("prefers the trusted addresses, comma-separated as Fastify expects", () => {
    expect(
      toTrustProxySetting({
        TRUST_PROXY_HOPS: 1,
        TRUST_PROXY_ADDRESSES: ["loopback", "uniquelocal"],
      }),
    ).toBe("loopback,uniquelocal");
  });
});
