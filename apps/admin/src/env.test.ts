import { afterEach, describe, expect, it, vi } from "vitest";

const loadServerEnv = async (vars: Readonly<Record<string, string>>) => {
  vi.resetModules();
  vi.stubEnv("SKIP_ENV_VALIDATION", "1");
  vi.stubEnv("API_INTERNAL_URL", "http://localhost:4000/");
  for (const [key, value] of Object.entries(vars)) vi.stubEnv(key, value);
  const { getServerEnv } = await import("./env");
  return getServerEnv;
};

describe("getServerEnv", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("reads the residents' app URL linked from «Sin acceso» (R-ACC-07)", async () => {
    const getServerEnv = await loadServerEnv({
      RESIDENT_APP_URL: "https://app.farmacia.example.cl",
    });

    expect(getServerEnv()).toMatchObject({
      API_INTERNAL_URL: "http://localhost:4000",
      RESIDENT_APP_URL: "https://app.farmacia.example.cl",
    });
  });

  it("treats a blank residents' app URL as not configured", async () => {
    const getServerEnv = await loadServerEnv({ RESIDENT_APP_URL: "" });

    expect(getServerEnv().RESIDENT_APP_URL).toBeUndefined();
  });

  it.each(["javascript:alert(1)", "app.farmacia.cl"])(
    "rejects %j as residents' app URL",
    async (url) => {
      const getServerEnv = await loadServerEnv({ RESIDENT_APP_URL: url });

      expect(() => getServerEnv()).toThrow(/RESIDENT_APP_URL/);
    },
  );
});
