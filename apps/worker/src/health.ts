import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";

import type { AppLogger } from "@repo/shared";

const HEALTH_PATH = "/health";

export type HealthServerOptions = {
  /** TCP port; `0` picks a free one (useful in tests). */
  port: number;
  host?: string;
  /** True while the worker can process jobs. Polled on every request. */
  isHealthy: () => boolean;
  logger: AppLogger;
};

export type HealthServer = {
  /** Starts listening and resolves with the bound port. */
  listen: () => Promise<number>;
  /** Makes `/health` answer 503 from now on (shutdown has started). */
  markShuttingDown: () => void;
  /** Stops accepting connections and closes idle keep-alive sockets. */
  close: () => Promise<void>;
};

const sendJson = (res: ServerResponse, status: number, body: Record<string, string>): void => {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
    "cache-control": "no-store",
  });
  res.end(payload);
};

const pathOf = (req: IncomingMessage): string => (req.url ?? "/").split("?")[0] ?? "/";

/** Tiny `node:http` server exposing `GET /health` for orchestrator probes. */
export const createHealthServer = (options: HealthServerOptions): HealthServer => {
  let shuttingDown = false;

  const server = createServer((req, res) => {
    if (pathOf(req) !== HEALTH_PATH) {
      sendJson(res, 404, { error: "not_found" });
      return;
    }
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.setHeader("allow", "GET, HEAD");
      sendJson(res, 405, { error: "method_not_allowed" });
      return;
    }
    if (shuttingDown) {
      sendJson(res, 503, { status: "shutting_down" });
      return;
    }
    const healthy = options.isHealthy();
    sendJson(res, healthy ? 200 : 503, { status: healthy ? "ok" : "unavailable" });
  });

  const listen = () =>
    new Promise<number>((resolve, reject) => {
      server.once("error", reject);
      server.listen(options.port, options.host, () => {
        server.off("error", reject);
        server.on("error", (error) => {
          options.logger.error({ err: error }, "Health server error");
        });
        const { port } = server.address() as AddressInfo;
        options.logger.info({ port }, "Health server listening");
        resolve(port);
      });
    });

  const close = () =>
    new Promise<void>((resolve, reject) => {
      if (!server.listening) {
        resolve();
        return;
      }
      server.close((error) => {
        if (error) reject(error);
        else resolve();
      });
      server.closeIdleConnections();
    });

  return {
    listen,
    markShuttingDown: () => {
      shuttingDown = true;
    },
    close,
  };
};
