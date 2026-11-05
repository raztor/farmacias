import { describe, expect, it } from "vitest";

import { APP_NAME, APP_SCHEME, AUTH_COOKIE_PREFIX } from "./constants";

describe("constants", () => {
  it("exposes the product name", () => {
    expect(APP_NAME).toBe("Farmacia Comunitaria Peñalolén");
  });

  it("exposes the mobile deep link scheme", () => {
    expect(APP_SCHEME).toBe("bnp");
  });

  it("prefixes auth cookies with the app scheme", () => {
    expect(AUTH_COOKIE_PREFIX).toBe("bnp");
  });
});
