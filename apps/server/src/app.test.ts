import { afterEach, describe, expect, it } from "vitest";

import type { ServerApp } from "./app";
import { buildTestApp, type FakeDepsOptions } from "./testing/fake-deps";
import type { AppConfig } from "./app.types";

let current: ServerApp | undefined;

const setup = async (options: FakeDepsOptions = {}, config: Partial<AppConfig> = {}) => {
  const built = await buildTestApp(options, config);
  current = built.app;
  return built;
};

afterEach(async () => {
  await current?.close();
  current = undefined;
});

describe("GET /health", () => {
  it("answers 200 without touching dependencies", async () => {
    const { app } = await setup({ database: "fail", redis: "fail" });
    const response = await app.inject({ method: "GET", url: "/health" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok" });
  });

  it("reuses a safe incoming x-request-id and replaces unsafe ones", async () => {
    const { app } = await setup();
    const reused = await app.inject({ url: "/health", headers: { "x-request-id": "abc-123" } });
    expect(reused.headers["x-request-id"]).toBe("abc-123");

    const unsafe = await app.inject({ url: "/health", headers: { "x-request-id": "bad id\n" } });
    expect(unsafe.headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe("GET /ready", () => {
  it("answers 200 when PostgreSQL and Redis respond", async () => {
    const { app } = await setup();
    const response = await app.inject({ method: "GET", url: "/ready" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok", checks: { database: "ok", redis: "ok" } });
    expect(response.headers["cache-control"]).toBe("no-store");
  });

  it("answers 503 when the database query fails", async () => {
    const { app } = await setup({ database: "fail" });
    const response = await app.inject({ method: "GET", url: "/ready" });
    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({
      status: "error",
      checks: { database: "error", redis: "ok" },
    });
  });

  it("answers 503 when Redis does not answer the ping", async () => {
    const { app } = await setup({ redis: "fail" });
    const response = await app.inject({ method: "GET", url: "/ready" });
    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({ checks: { database: "ok", redis: "error" } });
  });

  it("answers 503 when a dependency hangs past the timeout", async () => {
    const { app } = await setup({ database: "hang", redis: "hang" }, { readinessTimeoutMs: 20 });
    const response = await app.inject({ method: "GET", url: "/ready" });
    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({
      status: "error",
      checks: { database: "error", redis: "error" },
    });
  });
});

describe("security", () => {
  it("sets helmet security headers", async () => {
    const { app } = await setup();
    const response = await app.inject({ method: "GET", url: "/health" });
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["strict-transport-security"]).toContain("max-age=");
    expect(response.headers["content-security-policy"]).toContain("default-src 'self'");
    expect(response.headers["x-frame-options"]).toBe("SAMEORIGIN");
    expect(response.headers["x-powered-by"]).toBeUndefined();
  });

  it("allows CORS with credentials for a trusted origin", async () => {
    const { app } = await setup();
    const response = await app.inject({
      method: "OPTIONS",
      url: "/trpc/health.ping",
      headers: {
        origin: "http://localhost:8081",
        "access-control-request-method": "POST",
        "access-control-request-headers": "content-type",
      },
    });
    expect(response.statusCode).toBe(204);
    expect(response.headers["access-control-allow-origin"]).toBe("http://localhost:8081");
    expect(response.headers["access-control-allow-credentials"]).toBe("true");
  });

  it("allows wildcard subdomains of a trusted origin", async () => {
    const { app } = await setup();
    const response = await app.inject({
      url: "/health",
      headers: { origin: "https://admin.example.com" },
    });
    expect(response.headers["access-control-allow-origin"]).toBe("https://admin.example.com");
  });

  it("does not allow an untrusted origin", async () => {
    const { app } = await setup();
    for (const origin of ["https://evil.test", "https://example.com.evil.test"]) {
      const response = await app.inject({
        method: "OPTIONS",
        url: "/trpc/health.ping",
        headers: { origin, "access-control-request-method": "POST" },
      });
      // Without `Access-Control-Allow-Origin` the browser blocks the response.
      expect(response.headers["access-control-allow-origin"]).toBeUndefined();
    }
  });

  it("rate limits API routes but not health checks", async () => {
    const { app } = await setup({}, { rateLimitMax: 2 });
    const statuses: number[] = [];
    for (let i = 0; i < 3; i += 1) {
      const response = await app.inject({ url: "/trpc/health.ping" });
      statuses.push(response.statusCode);
    }
    expect(statuses).toEqual([200, 200, 429]);

    const limited = await app.inject({ url: "/trpc/health.ping" });
    expect(limited.json()).toMatchObject({ error: "TOO_MANY_REQUESTS" });
    expect(limited.headers["retry-after"]).toBeDefined();

    for (let i = 0; i < 3; i += 1) {
      const response = await app.inject({ url: "/health" });
      expect(response.statusCode).toBe(200);
    }
  });
});

describe("errors", () => {
  it("answers unknown routes with a 404 JSON body", async () => {
    const { app } = await setup();
    const response = await app.inject({ method: "GET", url: "/nope" });
    expect(response.statusCode).toBe(404);
    expect(response.headers["content-type"]).toContain("application/json");
    const body = response.json<{ error: string; requestId: string }>();
    expect(body.error).toBe("NOT_FOUND");
    expect(body.requestId).toBe(response.headers["x-request-id"]);
  });

  it("hides internal errors and reports them", async () => {
    const failure = new Error("auth exploded");
    const { app, reported } = await setup({ authHandler: () => Promise.reject(failure) });
    const response = await app.inject({ method: "GET", url: "/api/auth/get-session" });
    expect(response.statusCode).toBe(500);
    expect(response.json()).toMatchObject({ error: "INTERNAL" });
    expect(response.body).not.toContain("auth exploded");
    expect(reported).toEqual([failure]);
  });
});

describe("tRPC", () => {
  it("serves health.ping over HTTP", async () => {
    const { app } = await setup();
    const response = await app.inject({ method: "GET", url: "/trpc/health.ping" });
    expect(response.statusCode).toBe(200);
    const body = response.json<{ result: { data: { json: { status: string; time: string } } } }>();
    expect(body.result.data.json.status).toBe("ok");
    expect(Date.parse(body.result.data.json.time)).not.toBeNaN();
  });

  it("serves batched calls", async () => {
    const { app } = await setup();
    const response = await app.inject({
      method: "GET",
      url: "/trpc/health.ping,health.ping?batch=1&input=%7B%7D",
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toHaveLength(2);
  });

  it("rejects protected procedures without a session", async () => {
    const { app, reported } = await setup();
    const response = await app.inject({ method: "GET", url: "/trpc/user.me" });
    expect(response.statusCode).toBe(401);
    expect(reported).toEqual([]);
  });

  it("reports INTERNAL_SERVER_ERROR failures", async () => {
    const failure = new Error("database down");
    const { app, reported } = await setup({ getSession: () => Promise.reject(failure) });
    const response = await app.inject({ method: "GET", url: "/trpc/user.me" });
    expect(response.statusCode).toBe(500);
    expect(response.body).not.toContain("database down");
    expect(reported).toHaveLength(1);
  });
});
