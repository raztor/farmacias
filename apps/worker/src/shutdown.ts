import type { AppLogger } from "@repo/shared";

/** One shutdown task, run in order. A failing step is logged and the rest still run. */
export type ShutdownStep = {
  name: string;
  run: () => Promise<void> | void;
};

export type GracefulShutdownOptions = {
  steps: readonly ShutdownStep[];
  logger: AppLogger;
};

/**
 * Runs every step sequentially (order matters: stop intake, drain jobs, then flush telemetry).
 * Resolves `true` when all steps succeeded. Calling it again returns the same promise.
 */
export const createGracefulShutdown = ({
  steps,
  logger,
}: GracefulShutdownOptions): ((reason: string) => Promise<boolean>) => {
  let pending: Promise<boolean> | undefined;

  const runAll = async (reason: string): Promise<boolean> => {
    logger.info({ reason }, "Shutting down");
    let ok = true;
    for (const step of steps) {
      try {
        await step.run();
        logger.debug({ step: step.name }, "Shutdown step completed");
      } catch (error) {
        ok = false;
        logger.error({ err: error, step: step.name }, "Shutdown step failed");
      }
    }
    logger.info({ reason, ok }, "Shutdown complete");
    return ok;
  };

  return (reason) => {
    pending ??= runAll(reason);
    return pending;
  };
};
