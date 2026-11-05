// Imported first so observability is initialized even when `--import` was not used.
import { observability } from "./instrument";

import { captureException } from "@repo/observability";

import { buildApp, type ServerApp } from "./app";
import { createAppConfig, createInfrastructure, type Infrastructure } from "./deps";
import { env } from "./env";
import { logger } from "./logger";
import { createGracefulShutdown } from "./shutdown";

/** Hard limit for draining requests; orchestrators usually SIGKILL after 30s. */
const SHUTDOWN_TIMEOUT_MS = 25_000;

type Stop = (reason: string, exitCode: number) => void;

const createStopper = (infra: Infrastructure, getApp: () => ServerApp | undefined): Stop => {
  const shutdown = createGracefulShutdown({
    logger,
    steps: [
      // Stops accepting connections and waits for in-flight requests.
      {
        name: "http:close",
        run: async () => {
          await getApp()?.close();
        },
      },
      { name: "queue:close", run: infra.queue.close },
      { name: "db:disconnect", run: () => infra.db.$disconnect() },
      { name: "observability:shutdown", run: observability.shutdown },
    ],
  });

  return (reason, exitCode) => {
    const timer = setTimeout(() => {
      logger.fatal({ reason, timeoutMs: SHUTDOWN_TIMEOUT_MS }, "Shutdown timed out; forcing exit");
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
    timer.unref();
    void shutdown(reason).then((ok) => {
      process.exit(ok ? exitCode : 1);
    });
  };
};

const registerProcessHandlers = (stop: Stop): void => {
  process.once("SIGTERM", () => {
    stop("SIGTERM", 0);
  });
  process.once("SIGINT", () => {
    stop("SIGINT", 0);
  });
  process.on("uncaughtException", (error) => {
    logger.fatal({ err: error }, "Uncaught exception");
    captureException(error, { level: "fatal" });
    stop("uncaughtException", 1);
  });
  process.on("unhandledRejection", (reason) => {
    logger.fatal({ err: reason }, "Unhandled promise rejection");
    captureException(reason, { level: "fatal" });
    stop("unhandledRejection", 1);
  });
};

const main = async (): Promise<void> => {
  const infra = createInfrastructure(env, logger);
  let app: ServerApp | undefined;
  const stop = createStopper(infra, () => app);
  registerProcessHandlers(stop);

  try {
    app = await buildApp({ deps: { ...infra, logger }, config: createAppConfig(env) });
    await app.listen({ host: env.HOST, port: env.PORT });
  } catch (error) {
    logger.fatal({ err: error, host: env.HOST, port: env.PORT }, "Server failed to start");
    captureException(error, { level: "fatal" });
    stop("startup-failure", 1);
    return;
  }
  logger.info({ environment: env.NODE_ENV }, "Server ready");
};

main().catch((error: unknown) => {
  logger.fatal({ err: error }, "Server failed to start");
  captureException(error, { level: "fatal" });
  void observability.shutdown().finally(() => {
    process.exit(1);
  });
});
