import { beforeEach, describe, expect, it, vi } from "vitest";

const iitm = vi.hoisted(() => ({
  register: vi.fn(),
  supportsSyncHooks: vi.fn(() => true),
}));

vi.mock("import-in-the-middle/register-hooks.mjs", () => iitm);

/** Fresh module per test: the registration status is module state. */
const loadEsmHooks = async () => {
  vi.resetModules();
  return import("./esm-hooks");
};

beforeEach(() => {
  iitm.register.mockClear();
  iitm.supportsSyncHooks.mockReturnValue(true);
});

describe("registerEsmHooks", () => {
  it("registers the synchronous loader once, limited to instrumented modules", async () => {
    const { registerEsmHooks, INSTRUMENTED_PACKAGE_URL } = await loadEsmHooks();

    expect(registerEsmHooks()).toBe("registered");
    expect(registerEsmHooks()).toBe("already-registered");
    expect(iitm.register).toHaveBeenCalledTimes(1);
    expect(iitm.register).toHaveBeenCalledWith({
      include: ["http", "https", INSTRUMENTED_PACKAGE_URL],
    });
  });

  it("warns instead of throwing when the runtime lacks synchronous hooks", async () => {
    iitm.supportsSyncHooks.mockReturnValue(false);
    const emitWarning = vi.spyOn(process, "emitWarning").mockImplementation(() => undefined);
    const { registerEsmHooks } = await loadEsmHooks();

    expect(registerEsmHooks()).toBe("unsupported");
    expect(registerEsmHooks()).toBe("unsupported");
    expect(iitm.register).not.toHaveBeenCalled();
    expect(emitWarning).toHaveBeenCalledTimes(1);
    emitWarning.mockRestore();
  });
});

describe("INSTRUMENTED_PACKAGE_URL", () => {
  it("matches instrumented packages in pnpm and flat layouts", async () => {
    const { INSTRUMENTED_PACKAGE_URL } = await loadEsmHooks();
    const matching = [
      "file:///repo/node_modules/.pnpm/pg@8.23.1/node_modules/pg/lib/index.js",
      "file:///repo/node_modules/.pnpm/pg-pool@3.14.0_pg@8.23.1/node_modules/pg-pool/index.js",
      "file:///app/node_modules/ioredis/built/index.js",
    ];
    const ignored = [
      "file:///repo/node_modules/.pnpm/pg-protocol@1.0.0/node_modules/pg-protocol/dist/index.js",
      "file:///repo/node_modules/pino/pino.js",
      "file:///repo/apps/server/dist/index.js",
      "node:fs",
    ];

    expect(matching.filter((url) => INSTRUMENTED_PACKAGE_URL.test(url))).toEqual(matching);
    expect(ignored.filter((url) => INSTRUMENTED_PACKAGE_URL.test(url))).toEqual([]);
  });
});
