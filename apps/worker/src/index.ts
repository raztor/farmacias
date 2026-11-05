// Imported first so observability is initialized even when `--import` was not used.
import { observability } from "./instrument";

import { captureException } from "@repo/observability";
import { QUEUE_NAMES, createWorker, isFinalFailure, type QueueWorker } from "@repo/queue";

import { closeWorkers } from "./close-workers";
import { env } from "./env";
import { createHealthServer, type HealthServer } from "./health";
import { logger } from "./logger";
import { createSmtpMailer, type SmtpMailer } from "./mailer";
import { createEmailProcessor } from "./processors";
import { assertRedisDriverAvailable } from "./preflight";
import { createGracefulShutdown } from "./shutdown";

/** Time given to in-flight jobs to finish before force-closing the workers. */
const DRAIN_TIMEOUT_MS = 20_000;
/** Hard limit for the whole shutdown; orchestrators usually SIGKILL after 30s. */
const SHUTDOWN_TIMEOUT_MS = 27_000;

/** Reports jobs that will not be retried again (retries are expected and only logged). */
const reportFinalFailures = (worker: QueueWorker): void => {
  worker.on("failed", (job, error) => {
    if (job === undefined || isFinalFailure(job, error)) {
      captureException(error, { tags: { queue: worker.name, jobName: job?.name ?? "unknown" } });
    }
  });
};

const startWorkers = (mailer: SmtpMailer): QueueWorker[] => {
  const emailWorker = createWorker({
    queue: QUEUE_NAMES.email,
    redisUrl: env.REDIS_URL,
    concurrency: env.WORKER_CONCURRENCY,
    logger,
    process: createEmailProcessor({ mailer }),
  });
  const workers = [emailWorker];
  workers.forEach(reportFinalFailures);
  return workers;
};

const createStopper = (deps: {
  workers: readonly QueueWorker[];
  mailer: SmtpMailer;
  health: HealthServer;
}) => {
  const shutdown = createGracefulShutdown({
    logger,
    steps: [
      { name: "health:mark-shutting-down", run: deps.health.markShuttingDown },
      {
        name: "workers:close",
        run: () =>
          closeWorkers({ workers: deps.workers, drainTimeoutMs: DRAIN_TIMEOUT_MS, logger }),
      },
      { name: "mailer:close", run: deps.mailer.close },
      { name: "health:close", run: deps.health.close },
      { name: "observability:shutdown", run: observability.shutdown },
    ],
  });

  return (reason: string, exitCode: number): void => {
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

const registerProcessHandlers = (stop: (reason: string, exitCode: number) => void): void => {
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
  assertRedisDriverAvailable();
  const mailer = createSmtpMailer(env.SMTP_URL, env.EMAIL_FROM);
  const workers = startWorkers(mailer);
  const health = createHealthServer({
    port: env.WORKER_HEALTH_PORT,
    isHealthy: () => workers.every((worker) => worker.isRunning()),
    logger,
  });
  const stop = createStopper({ workers, mailer, health });
  registerProcessHandlers(stop);

  try {
    await health.listen();
  } catch (error) {
    logger.fatal({ err: error, port: env.WORKER_HEALTH_PORT }, "Health server failed to start");
    captureException(error, { level: "fatal" });
    stop("startup-failure", 1);
    return;
  }
  logger.info({ queues: workers.map((worker) => worker.name) }, "Worker ready");
};

main().catch((error: unknown) => {
  logger.fatal({ err: error }, "Worker failed to start");
  captureException(error, { level: "fatal" });
  void observability.shutdown().finally(() => {
    process.exit(1);
  });
});
