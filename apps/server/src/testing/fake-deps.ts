import type { PrismaClient } from "@repo/db";
import { createLogger } from "@repo/observability";
import type { QueueClient } from "@repo/queue";

import { buildApp, type ServerApp } from "../app";
import type { AppConfig, AuthRequestHandler, ServerDependencies } from "../app.types";

/**
 * Test doubles for `buildApp`. Kept free of `vitest` imports so this file never depends on
 * dev-only packages at runtime (it is only imported by tests).
 */

export type ProbeBehavior = "ok" | "fail" | "hang";

export type FakeDepsOptions = {
  database?: ProbeBehavior;
  redis?: ProbeBehavior;
  /** Better Auth `handler` stand-in; defaults to a 404 JSON response. */
  authHandler?: AuthRequestHandler["handler"];
  /** Better Auth `getSession` stand-in; defaults to an anonymous session. */
  getSession?: ServerDependencies["auth"]["api"]["getSession"];
};

export type FakeDeps = {
  deps: ServerDependencies;
  /** Errors handed to `reportError` (Sentry in production). */
  reported: unknown[];
};

const never = (): Promise<never> =>
  new Promise<never>(() => {
    // Intentionally never settles: simulates a dependency that does not answer.
  });

const probe = <T>(behavior: ProbeBehavior, ok: T, failure: () => Promise<T>): Promise<T> => {
  switch (behavior) {
    case "ok":
      return Promise.resolve(ok);
    case "fail":
      return failure();
    case "hang":
      return never();
  }
};

export const createFakeDeps = (options: FakeDepsOptions = {}): FakeDeps => {
  const reported: unknown[] = [];
  const db = {
    $queryRaw: () =>
      probe(options.database ?? "ok", [{ ok: 1 }], () =>
        Promise.reject(new Error("connect ECONNREFUSED 127.0.0.1:5432")),
      ),
  } as unknown as PrismaClient;
  const queue: QueueClient = {
    enqueue: () => Promise.reject(new Error("queue.enqueue is not stubbed")),
    ping: () => probe(options.redis ?? "ok", true, () => Promise.resolve(false)),
    close: () => Promise.resolve(),
  };
  const auth: ServerDependencies["auth"] = {
    api: { getSession: options.getSession ?? (() => Promise.resolve(null)) },
    handler:
      options.authHandler ??
      (() => Promise.resolve(Response.json({ message: "Not found" }, { status: 404 }))),
  };
  const deps: ServerDependencies = {
    db,
    queue,
    auth,
    logger: createLogger({ service: "server-test", level: "silent" }),
    reportError: (error) => {
      reported.push(error);
    },
  };
  return { deps, reported };
};

export const TEST_CONFIG: AppConfig = {
  trustedOrigins: ["http://localhost:8081", "https://*.example.com", "bnp://"],
  rateLimitMax: 100,
  readinessTimeoutMs: 50,
};

/** Builds the app with fake dependencies; remember to `close()` it. */
export const buildTestApp = async (
  options: FakeDepsOptions = {},
  config: Partial<AppConfig> = {},
): Promise<{ app: ServerApp; reported: unknown[] }> => {
  const { deps, reported } = createFakeDeps(options);
  const app = await buildApp({ deps, config: { ...TEST_CONFIG, ...config } });
  return { app, reported };
};
