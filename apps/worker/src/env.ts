import { parseWorkerEnv, type WorkerEnv } from "./env.schema";

/** Validated configuration, read once at startup. */
export const env: WorkerEnv = parseWorkerEnv(process.env);
