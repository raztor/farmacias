import { createEnv } from "@repo/shared";
import { z } from "zod";

/**
 * Validated environment of the admin backoffice.
 *
 * - `clientEnv`: `NEXT_PUBLIC_*` variables, read literally so Next.js inlines them in the bundle.
 *   Validated when the module loads (also during `next build`).
 * - `getServerEnv()`: server-only variables, validated on first use at request time and never
 *   exposed to the browser.
 *
 * `SKIP_ENV_VALIDATION=1` skips the build-time validation (Docker image builds, CI jobs without
 * secrets). Server variables are still validated when a request needs them.
 */

const skipValidation = ["1", "true"].includes(process.env.SKIP_ENV_VALIDATION ?? "");

const nodeEnvSchema = z.enum(["development", "test", "production"]).default("development");

const clientSchema = z.object({
  NODE_ENV: nodeEnvSchema,
  NEXT_PUBLIC_SENTRY_DSN: z.url().optional(),
});

const serverSchema = z.object({
  NODE_ENV: nodeEnvSchema,
  API_INTERNAL_URL: z.url().transform((value) => value.replace(/\/+$/, "")),
  /** Residents' app (Expo web export): the «Sin acceso» page links to it (R-ACC-07). Optional. */
  RESIDENT_APP_URL: z.url({ protocol: /^https?$/ }).optional(),
});

export type ClientEnv = z.output<typeof clientSchema>;
export type ServerEnv = z.output<typeof serverSchema>;

const clientSource = {
  NODE_ENV: process.env.NODE_ENV,
  NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
};

const unvalidatedClientEnv = (): ClientEnv => {
  const dsn = clientSource.NEXT_PUBLIC_SENTRY_DSN;
  return {
    NODE_ENV: nodeEnvSchema.catch("production").parse(clientSource.NODE_ENV),
    NEXT_PUBLIC_SENTRY_DSN: dsn === "" ? undefined : dsn,
  };
};

export const clientEnv: ClientEnv = skipValidation
  ? unvalidatedClientEnv()
  : createEnv(clientSchema, clientSource);

let serverEnv: ServerEnv | undefined;

/** Server-only variables. Throws if called from browser code or if a variable is invalid. */
export function getServerEnv(): ServerEnv {
  if (typeof window !== "undefined") {
    throw new Error("getServerEnv() must only be called on the server");
  }
  serverEnv ??= createEnv(serverSchema, process.env);
  return serverEnv;
}
