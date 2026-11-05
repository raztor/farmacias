import { request } from "node:http";

import { noopLogger } from "@repo/shared";
import { afterEach, describe, expect, it } from "vitest";

import { createHealthServer, type HealthServer } from "./health";

type Reply = { status: number; body: string; headers: Record<string, unknown> };

const call = (port: number, path: string, method = "GET"): Promise<Reply> =>
  new Promise((resolve, reject) => {
    const req = request({ host: "127.0.0.1", port, path, method }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk: string) => (body += chunk));
      res.on("end", () => {
        resolve({ status: res.statusCode ?? 0, body, headers: res.headers });
      });
    });
    req.on("error", reject);
    req.end();
  });

describe("createHealthServer", () => {
  let server: HealthServer | undefined;
  let healthy = true;

  const start = async (): Promise<number> => {
    server = createHealthServer({
      port: 0,
      host: "127.0.0.1",
      isHealthy: () => healthy,
      logger: noopLogger,
    });
    return server.listen();
  };

  afterEach(async () => {
    await server?.close();
    server = undefined;
    healthy = true;
  });

  it("answers 200 while the workers are running", async () => {
    const port = await start();

    const reply = await call(port, "/health");

    expect(reply.status).toBe(200);
    expect(JSON.parse(reply.body)).toEqual({ status: "ok" });
    expect(reply.headers["cache-control"]).toBe("no-store");
  });

  it("answers 503 when a worker is not running", async () => {
    const port = await start();
    healthy = false;

    const reply = await call(port, "/health");

    expect(reply.status).toBe(503);
    expect(JSON.parse(reply.body)).toEqual({ status: "unavailable" });
  });

  it("answers 503 after shutdown starts, even if workers still run", async () => {
    const port = await start();
    server?.markShuttingDown();

    const reply = await call(port, "/health?probe=liveness");

    expect(reply.status).toBe(503);
    expect(JSON.parse(reply.body)).toEqual({ status: "shutting_down" });
  });

  it("answers 404 for unknown paths and 405 for other methods", async () => {
    const port = await start();

    expect((await call(port, "/metrics")).status).toBe(404);
    const reply = await call(port, "/health", "POST");
    expect(reply.status).toBe(405);
    expect(reply.headers.allow).toBe("GET, HEAD");
  });

  it("stops accepting connections after close", async () => {
    const port = await start();
    await server?.close();

    await expect(call(port, "/health")).rejects.toThrow();
  });

  it("rejects listen when the port is taken", async () => {
    const port = await start();
    const other = createHealthServer({
      port,
      host: "127.0.0.1",
      isHealthy: () => true,
      logger: noopLogger,
    });

    await expect(other.listen()).rejects.toThrow(/EADDRINUSE/);
  });
});
