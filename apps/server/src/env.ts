import { parseServerEnv, type ServerEnv } from "./env.schema";

/** Validated configuration, read once at startup. */
export const env: ServerEnv = parseServerEnv(process.env);
