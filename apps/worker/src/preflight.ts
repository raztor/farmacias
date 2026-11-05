import { createRequire } from "node:module";

/** Resolves `id` as `require.resolve` would from the module at `from`. */
export type ModuleResolver = (from: string, id: string) => string;

const nodeResolver: ModuleResolver = (from, id) => createRequire(from).resolve(id);

/**
 * BullMQ 6 loads its Redis driver (`ioredis`, an optional peer dependency) lazily with `require`.
 * When the driver is missing, every Redis call fails in a tight promise loop that starves the
 * event loop (health checks and signals stop being served), so check it before starting workers.
 *
 * @param from - module URL or absolute path the lookup starts from (defaults to this module).
 * @param resolve - module resolver (defaults to Node's; injectable so tests stay hermetic).
 * @throws Error explaining how to fix the deployment when `bullmq` or `ioredis` cannot be resolved.
 */
export const assertRedisDriverAvailable = (
  from: string = import.meta.url,
  resolve: ModuleResolver = nodeResolver,
): void => {
  try {
    const bullmqEntry = resolve(from, "bullmq");
    resolve(bullmqEntry, "ioredis");
  } catch (error) {
    throw new Error(
      "BullMQ cannot load its Redis driver: install `ioredis` next to `bullmq` (catalog dependency).",
      { cause: error },
    );
  }
};
