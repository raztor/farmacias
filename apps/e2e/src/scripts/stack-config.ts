/**
 * Configuration of the local E2E stack (docs/validation/e2e.md). Defaults reproduce the dev
 * setup (`docker-compose.yml` services, apps on 4000/3001/8081) but on a DEDICATED database
 * (`farmacias_e2e`) and Redis db 1, so E2E data never mixes with development data.
 *
 * Variables (all optional):
 * - `E2E_SERVICES`: `compose` (default: `docker-compose.yml` up --wait) or `external` (CI
 *   service containers or your own PostgreSQL/Redis).
 * - `E2E_COMPOSE`: compose command, e.g. `docker compose`, `docker-compose`, `podman compose`
 *   (default: the first one that works).
 * - `E2E_DATABASE_URL`, `E2E_REDIS_URL`, `E2E_SMTP_URL`: infrastructure URLs.
 * - `E2E_API_PORT`, `E2E_ADMIN_PORT`, `E2E_WEB_PORT`, `E2E_WORKER_HEALTH_PORT`: ports.
 * - `E2E_SKIP_BUILD=1`: reuse the existing builds (server/worker dist, admin .next, web export).
 * - `SEED_RESIDENT_PASSWORD`, `SEED_OPERATOR_PASSWORD`, `SEED_ADMIN_PASSWORD`: synthetic seed
 *   passwords (defaults: the values of `apps/server/.env.example`).
 */
import { randomBytes } from "node:crypto";
import { join } from "node:path";

import { DEFAULT_SEED_PASSWORDS, E2E_PORTS, E2E_URLS } from "../support/env.ts";

export const REPO_ROOT = join(import.meta.dirname, "../../../..");
export const E2E_DIR = join(REPO_ROOT, "apps/e2e");

const read = (name: string, fallback: string): string => {
  const value = process.env[name]?.trim();
  return value === undefined || value === "" ? fallback : value;
};

export type ServicesMode = "compose" | "external";

export type StackConfig = Readonly<{
  services: ServicesMode;
  composeCommand: string | null;
  skipBuild: boolean;
  databaseUrl: string;
  redisUrl: string;
  smtpUrl: string;
  ports: typeof E2E_PORTS;
  urls: typeof E2E_URLS;
  seedPasswords: Readonly<{ resident: string; operator: string; admin: string }>;
  /** Random per run: sessions never outlive the stack. */
  authSecret: string;
}>;

const servicesMode = (): ServicesMode => {
  const mode = read("E2E_SERVICES", "compose");
  if (mode !== "compose" && mode !== "external") {
    throw new Error(`E2E_SERVICES must be "compose" or "external", got "${mode}"`);
  }
  return mode;
};

export function loadStackConfig(): StackConfig {
  const composeCommand = process.env.E2E_COMPOSE?.trim();
  return {
    services: servicesMode(),
    composeCommand: composeCommand === undefined || composeCommand === "" ? null : composeCommand,
    skipBuild: read("E2E_SKIP_BUILD", "0") === "1",
    databaseUrl: read("E2E_DATABASE_URL", "postgresql://app:app@127.0.0.1:5432/farmacias_e2e"),
    redisUrl: read("E2E_REDIS_URL", "redis://127.0.0.1:6379/1"),
    smtpUrl: read("E2E_SMTP_URL", "smtp://127.0.0.1:1025"),
    ports: E2E_PORTS,
    urls: E2E_URLS,
    seedPasswords: {
      resident: read("SEED_RESIDENT_PASSWORD", DEFAULT_SEED_PASSWORDS.resident),
      operator: read("SEED_OPERATOR_PASSWORD", DEFAULT_SEED_PASSWORDS.operator),
      admin: read("SEED_ADMIN_PASSWORD", DEFAULT_SEED_PASSWORDS.admin),
    },
    authSecret: randomBytes(32).toString("hex"),
  };
}

/** Browser origins that call the API: admin (rewrites) and the web export (proxy). */
const trustedOrigins = (config: StackConfig): string => {
  const origins = [config.urls.admin, config.urls.mobileWeb].flatMap((url) => {
    const { port } = new URL(url);
    return [new URL(url).origin, `http://127.0.0.1:${port}`, `http://localhost:${port}`];
  });
  return [...new Set(origins)].join(",");
};

/** Environment of `apps/server` (API) and of the seed script. */
export function serverEnv(config: StackConfig): Record<string, string> {
  return {
    // `test`: no Secure cookies over plain http and no Better Auth database rate limiter.
    NODE_ENV: "test",
    LOG_LEVEL: "warn",
    HOST: "127.0.0.1",
    PORT: String(config.ports.api),
    DATABASE_URL: config.databaseUrl,
    REDIS_URL: config.redisUrl,
    BETTER_AUTH_SECRET: config.authSecret,
    BETTER_AUTH_URL: config.urls.api,
    TRUSTED_ORIGINS: trustedOrigins(config),
    TRUST_PROXY_HOPS: "1",
    // Every parallel browser shares 127.0.0.1: the per-IP limit would throttle the suite.
    RATE_LIMIT_MAX: "100000",
    SEED_RESIDENT_PASSWORD: config.seedPasswords.resident,
    SEED_OPERATOR_PASSWORD: config.seedPasswords.operator,
    SEED_ADMIN_PASSWORD: config.seedPasswords.admin,
  };
}

/** Environment of `apps/worker`. */
export function workerEnv(config: StackConfig): Record<string, string> {
  return {
    NODE_ENV: "test",
    LOG_LEVEL: "warn",
    REDIS_URL: config.redisUrl,
    DATABASE_URL: config.databaseUrl,
    SMTP_URL: config.smtpUrl,
    EMAIL_FROM: "Farmacia Comunitaria E2E <no-reply@demo.farmacia.cl>",
    WORKER_HEALTH_PORT: String(config.ports.workerHealth),
  };
}

/**
 * Environment of `apps/admin` (build: rewrites; runtime: server-side session lookup and the
 * residents' app linked from «Sin acceso»).
 */
export function adminEnv(config: StackConfig): Record<string, string> {
  return {
    API_INTERNAL_URL: config.urls.api,
    RESIDENT_APP_URL: config.urls.mobileWeb,
    NEXT_TELEMETRY_DISABLED: "1",
  };
}

/** Environment of the Expo web export: empty API URL = same origin (proxied, like Caddy). */
export function webExportEnv(): Record<string, string> {
  return { EXPO_PUBLIC_API_URL: "", EXPO_NO_TELEMETRY: "1" };
}

/** Environment handed to Playwright so the specs reach this stack and its seed accounts. */
export function playwrightEnv(config: StackConfig): Record<string, string> {
  return {
    E2E_API_URL: config.urls.api,
    E2E_ADMIN_URL: config.urls.admin,
    E2E_MOBILE_WEB_URL: config.urls.mobileWeb,
    SEED_RESIDENT_PASSWORD: config.seedPasswords.resident,
    SEED_OPERATOR_PASSWORD: config.seedPasswords.operator,
    SEED_ADMIN_PASSWORD: config.seedPasswords.admin,
  };
}
