import { afterEach, describe, expect, it } from "vitest";

import type { ServerApp } from "../app";
import { buildTestApp } from "../testing/fake-deps";

let current: ServerApp | undefined;

afterEach(async () => {
  await current?.close();
  current = undefined;
});

const setupWithHandler = async (handler: (request: Request) => Promise<Response>) => {
  const { app } = await buildTestApp({ authHandler: handler });
  current = app;
  return app;
};

describe("auth bridge (/api/auth/*)", () => {
  it("forwards method, URL, headers and the raw body to Better Auth", async () => {
    const received: { request?: Request; body?: string } = {};
    const app = await setupWithHandler(async (request) => {
      received.request = request;
      received.body = await request.text();
      return Response.json({ ok: true });
    });

    const payload = JSON.stringify({ email: "ana@example.com", password: "secret-123" });
    const response = await app.inject({
      method: "POST",
      url: "/api/auth/sign-in/email?callback=%2Fhome",
      headers: {
        "content-type": "application/json",
        cookie: "bnp.session_token=abc",
        host: "api.test",
      },
      payload,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true });
    expect(received.request?.method).toBe("POST");
    expect(received.request?.url).toBe("http://api.test/api/auth/sign-in/email?callback=%2Fhome");
    expect(received.request?.headers.get("cookie")).toBe("bnp.session_token=abc");
    expect(received.request?.headers.get("content-type")).toBe("application/json");
    expect(received.body).toBe(payload);
  });

  it("hands Better Auth the client IP resolved by Fastify (one trusted proxy hop)", async () => {
    const seen: (string | null)[] = [];
    const app = await setupWithHandler((request) => {
      seen.push(request.headers.get("x-forwarded-for"));
      return Promise.resolve(Response.json({}));
    });
    const forwardedFor = ["203.0.113.9", "1.2.3.4, 203.0.113.9"];
    for (const value of forwardedFor) {
      await app.inject({
        url: "/api/auth/get-session",
        remoteAddress: "10.0.0.7",
        headers: { "x-forwarded-for": value },
      });
    }
    // The address appended by the load balancer wins; a spoofed left-most value is ignored.
    expect(seen).toEqual(["203.0.113.9", "203.0.113.9"]);
  });

  it("accepts form-encoded bodies untouched", async () => {
    let body = "";
    const app = await setupWithHandler(async (request) => {
      body = await request.text();
      return new Response(null, { status: 204 });
    });
    const response = await app.inject({
      method: "POST",
      url: "/api/auth/sign-out",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      payload: "a=1&b=2",
    });
    expect(response.statusCode).toBe(204);
    expect(body).toBe("a=1&b=2");
  });

  it("keeps every Set-Cookie header separate", async () => {
    const app = await setupWithHandler(() => {
      const headers = new Headers({ "content-type": "application/json", "x-custom": "1" });
      headers.append(
        "set-cookie",
        "bnp.session_token=t1; Path=/; HttpOnly; Expires=Wed, 01 Jan 2027 00:00:00 GMT",
      );
      headers.append("set-cookie", "bnp.session_data=d1; Path=/; HttpOnly");
      return Promise.resolve(
        new Response(JSON.stringify({ user: { id: "u1" } }), { status: 200, headers }),
      );
    });

    const response = await app.inject({ method: "GET", url: "/api/auth/get-session" });

    expect(response.statusCode).toBe(200);
    expect(response.headers["set-cookie"]).toEqual([
      "bnp.session_token=t1; Path=/; HttpOnly; Expires=Wed, 01 Jan 2027 00:00:00 GMT",
      "bnp.session_data=d1; Path=/; HttpOnly",
    ]);
    expect(response.headers["x-custom"]).toBe("1");
    expect(response.cookies.map((cookie) => cookie.name)).toEqual([
      "bnp.session_token",
      "bnp.session_data",
    ]);
  });

  it("propagates Better Auth status codes and redirects", async () => {
    const app = await setupWithHandler(() =>
      Promise.resolve(
        new Response(null, { status: 302, headers: { location: "http://localhost:8081/" } }),
      ),
    );
    const response = await app.inject({ method: "GET", url: "/api/auth/callback/x" });
    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe("http://localhost:8081/");
  });

  it("does not expose other methods", async () => {
    const app = await setupWithHandler(() => Promise.resolve(Response.json({})));
    const response = await app.inject({ method: "DELETE", url: "/api/auth/session" });
    expect(response.statusCode).toBe(404);
  });
});
