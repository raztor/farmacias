/**
 * Boots the full local stack for the E2E suite (docs/validation/e2e.md):
 *
 *   1. PostgreSQL + Redis + Mailpit (`docker-compose.yml`, or external services in CI);
 *   2. `prisma migrate deploy` + idempotent seed on the dedicated `farmacias_e2e` database;
 *   3. production builds: server, worker, admin (`next build`) and the Expo web export;
 *   4. API (:4000), worker (/health :4100), admin `next start` (:3001) and the web export served
 *      on :8081 with `/api/auth` + `/trpc` proxied to the API (same as Caddy in production).
 *
 * Usage (from the repo root):
 *
 *   pnpm --filter @repo/e2e e2e:full [-- <playwright args>]   # boot, run the suite, stop
 *   pnpm --filter @repo/e2e e2e:stack                         # boot and keep running (Ctrl+C)
 *
 * Playwright arguments go through as-is, e.g. `-- --project=admin-chromium`.
 */
import { join } from "node:path";

import { log, runAttached, stopService, type Service } from "./process-utils.ts";
import { E2E_DIR, loadStackConfig, playwrightEnv, type StackConfig } from "./stack-config.ts";
import { buildApps, prepareDatabase, startApps, startInfrastructure } from "./stack-steps.ts";

type Mode = "up" | "test";

const parseMode = (value: string | undefined): Mode => {
  if (value === "up" || value === "test") return value;
  throw new Error(`Usage: e2e-stack.ts <up|test> [playwright args], got "${String(value)}"`);
};

async function stopAll(services: readonly Service[]): Promise<void> {
  for (const service of [...services].reverse()) {
    log(`↓ ${service.label}`);
    await stopService(service);
  }
}

async function boot(config: StackConfig, services: Service[]): Promise<void> {
  await startInfrastructure(config);
  await prepareDatabase(config);
  await buildApps(config);
  await startApps(config, services);
  log(
    `Stack listo — API ${config.urls.api} · admin ${config.urls.admin} · web ${config.urls.mobileWeb}`,
  );
}

const runPlaywright = (config: StackConfig, args: readonly string[]): Promise<number> =>
  runAttached({
    label: "playwright",
    command: join(E2E_DIR, "node_modules/.bin/playwright"),
    args: ["test", ...args],
    cwd: E2E_DIR,
    env: playwrightEnv(config),
  });

/** Keeps the stack up until Ctrl+C / SIGTERM. */
const waitForSignal = (): Promise<void> =>
  new Promise((resolve) => {
    process.once("SIGINT", () => {
      resolve();
    });
    process.once("SIGTERM", () => {
      resolve();
    });
  });

async function main(): Promise<void> {
  const [modeArg, ...rest] = process.argv.slice(2);
  const mode = parseMode(modeArg);
  const playwrightArgs = rest[0] === "--" ? rest.slice(1) : rest;
  const config = loadStackConfig();
  const services: Service[] = [];
  if (mode === "test") {
    // Ctrl+C while booting or testing: stop what already started (services are detached).
    const abort = () => {
      void stopAll(services).finally(() => process.exit(130));
    };
    process.once("SIGINT", abort);
    process.once("SIGTERM", abort);
  }
  try {
    await boot(config, services);
    if (mode === "up") {
      log("Ctrl+C para detener. Corre la suite con: pnpm --filter @repo/e2e test:e2e");
      await waitForSignal();
      return;
    }
    process.exitCode = await runPlaywright(config, playwrightArgs);
  } finally {
    await stopAll(services);
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`[e2e-stack] ${error instanceof Error ? error.message : String(error)}\n`);
  if (error instanceof Error && error.cause !== undefined) {
    const { cause } = error;
    process.stderr.write(
      `  causa: ${cause instanceof Error ? cause.message : JSON.stringify(cause)}\n`,
    );
  }
  process.exitCode = 1;
});
