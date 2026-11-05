import type * as Observability from "@repo/observability";
import type { FastifyOtelPlugin } from "@repo/observability";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ServerApp } from "./app";
import { buildTestApp } from "./testing/fake-deps";

/** Plugin returned by the mocked `getFastifyOtelPlugin` (`undefined` = tracing off). */
const otel = vi.hoisted(() => ({ plugin: undefined as FastifyOtelPlugin | undefined }));

vi.mock("@repo/observability", async (importOriginal) => ({
  ...(await importOriginal<typeof Observability>()),
  getFastifyOtelPlugin: () => otel.plugin,
}));

let current: ServerApp | undefined;

afterEach(async () => {
  await current?.close();
  current = undefined;
  otel.plugin = undefined;
});

describe("OpenTelemetry Fastify plugin", () => {
  it("is not registered when tracing is off", async () => {
    current = (await buildTestApp()).app;

    expect(current.hasPlugin("@fastify/otel")).toBe(false);
  });

  it("is registered before every route when tracing is on", async () => {
    const routes: string[] = [];
    // Stand-in for `@fastify/otel`: it only sees the routes added after its registration.
    const plugin: FastifyOtelPlugin = (instance, _options, done) => {
      instance.addHook("onRoute", (route) => {
        routes.push(route.url);
      });
      done();
    };
    Object.assign(plugin, {
      [Symbol.for("skip-override")]: true,
      [Symbol.for("fastify.display-name")]: "@fastify/otel",
    });
    otel.plugin = plugin;

    current = (await buildTestApp()).app;
    await current.ready();

    expect(current.hasPlugin("@fastify/otel")).toBe(true);
    expect(routes).toEqual(expect.arrayContaining(["/health", "/ready", "/trpc/:path"]));
  });
});
