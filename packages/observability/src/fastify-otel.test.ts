import { afterEach, describe, expect, it, vi } from "vitest";

/** Fresh module per test: the instrumentation is a per-process singleton. */
const loadModule = async () => {
  vi.resetModules();
  return import("./fastify-otel");
};

let created: { disable: () => void } | undefined;

afterEach(() => {
  created?.disable();
  created = undefined;
});

describe("getFastifyOtelPlugin", () => {
  it("is undefined while tracing has not created the instrumentation", async () => {
    const { getFastifyOtelPlugin } = await loadModule();

    expect(getFastifyOtelPlugin()).toBeUndefined();
  });

  it("returns the @fastify/otel plugin once the instrumentation exists and is enabled", async () => {
    const { createFastifyInstrumentation, getFastifyOtelPlugin } = await loadModule();
    const instrumentation = createFastifyInstrumentation();
    created = instrumentation;

    expect(createFastifyInstrumentation()).toBe(instrumentation);
    const plugin = getFastifyOtelPlugin();
    expect(typeof plugin).toBe("function");
    expect(plugin?.[Symbol.for("fastify.display-name") as keyof typeof plugin]).toBe(
      "@fastify/otel",
    );

    instrumentation.disable();
    expect(getFastifyOtelPlugin()).toBeUndefined();
  });

  it("skips the probe routes and instruments the rest", async () => {
    const { createFastifyInstrumentation } = await loadModule();
    const instrumentation = createFastifyInstrumentation();
    created = instrumentation;
    const { ignorePaths } = instrumentation.getConfig();

    expect(typeof ignorePaths).toBe("function");
    const ignores = (url: string) =>
      typeof ignorePaths === "function" && ignorePaths({ url, method: "GET" });
    expect(ignores("/health")).toBe(true);
    expect(ignores("/ready")).toBe(true);
    expect(ignores("/trpc/:path")).toBe(false);
    expect(ignores("/api/auth/*")).toBe(false);
  });
});
