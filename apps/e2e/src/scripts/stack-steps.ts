/**
 * Steps of the E2E stack: infrastructure, migrations + seed, builds and the four app processes.
 * See `e2e-stack.ts` for the order and docs/validation/e2e.md for the rationale.
 */
import { join } from "node:path";

import {
  assertPortFree,
  log,
  runStep,
  startService,
  tryStep,
  waitForHttp,
  type ProcessSpec,
  type Service,
} from "./process-utils.ts";
import {
  E2E_DIR,
  REPO_ROOT,
  adminEnv,
  serverEnv,
  webExportEnv,
  workerEnv,
  type StackConfig,
} from "./stack-config.ts";

const COMPOSE_CANDIDATES = ["docker compose", "docker-compose", "podman compose"] as const;

const commandSpec = (label: string, commandLine: string, args: readonly string[]): ProcessSpec => {
  const [command = commandLine, ...prefix] = commandLine.split(" ");
  return { label, command, args: [...prefix, ...args], cwd: REPO_ROOT };
};

async function resolveComposeCommand(config: StackConfig): Promise<string> {
  if (config.composeCommand !== null) return config.composeCommand;
  for (const candidate of COMPOSE_CANDIDATES) {
    if (await tryStep(commandSpec("compose-probe", candidate, ["version"]))) return candidate;
  }
  throw new Error(
    "No compose command found (docker compose / docker-compose / podman compose). " +
      "Set E2E_COMPOSE, or E2E_SERVICES=external with E2E_DATABASE_URL and E2E_REDIS_URL.",
  );
}

/**
 * PostgreSQL, Redis and Mailpit from `docker-compose.yml` (project `farmacias`, the same as
 * `pnpm dev:services`). `up --wait` is idempotent and waits for the health checks. The services
 * stay up afterwards: stop them with `pnpm dev:services:down` (never `-v` from here).
 */
export async function startInfrastructure(config: StackConfig): Promise<void> {
  if (config.services === "external") {
    log("Servicios externos (E2E_SERVICES=external): no se usa compose");
    return;
  }
  const compose = await resolveComposeCommand(config);
  await runStep(
    commandSpec("compose-up", compose, [
      "-f",
      "docker-compose.yml",
      "up",
      "-d",
      "--wait",
      "postgres",
      "redis",
      "mailpit",
    ]),
  );
}

const pnpm = (
  label: string,
  args: readonly string[],
  env: Record<string, string>,
): ProcessSpec => ({
  label,
  command: "pnpm",
  args,
  cwd: REPO_ROOT,
  env,
});

/**
 * Generates the Prisma client (it is git-ignored, so a fresh checkout such as CI has none),
 * then `prisma migrate deploy` (creates the E2E database when missing) and the idempotent seed.
 */
export async function prepareDatabase(config: StackConfig): Promise<void> {
  const env = serverEnv(config);
  await runStep(pnpm("db-generate", ["--filter", "@repo/db", "db:generate"], env));
  await runStep(pnpm("db-migrate", ["--filter", "@repo/db", "db:deploy"], env));
  await runStep(pnpm("db-seed", ["--filter", "@repo/server", "db:seed"], env));
}

/** Production builds: server and worker (tsup), admin (`next build`), Expo web export. */
export async function buildApps(config: StackConfig): Promise<void> {
  if (config.skipBuild) {
    log("E2E_SKIP_BUILD=1: se reutilizan los builds existentes");
    return;
  }
  const filters = ["@repo/server", "@repo/worker", "@repo/admin"].map((name) => `--filter=${name}`);
  await runStep(pnpm("build", ["turbo", "run", "build", ...filters], adminEnv(config)));
  await runStep(pnpm("export-web", ["--filter", "@repo/mobile", "export:web"], webExportEnv()));
}

const nodeApp = (app: string, env: Record<string, string>): ProcessSpec => ({
  label: app,
  command: process.execPath,
  args: ["--import", "./dist/instrument.js", "dist/index.js"],
  cwd: join(REPO_ROOT, "apps", app),
  env,
});

/**
 * Starts API, worker, admin (`next start`) and the static web server, waiting for each one.
 * Every started service is pushed to `services` right away, so the caller can stop them even
 * when a later one fails.
 */
export async function startApps(config: StackConfig, services: Service[]): Promise<void> {
  const ports = [
    [config.ports.api, "E2E_API_PORT"],
    [config.ports.workerHealth, "E2E_WORKER_HEALTH_PORT"],
    [config.ports.admin, "E2E_ADMIN_PORT"],
    [config.ports.web, "E2E_WEB_PORT"],
  ] as const;
  for (const [port, variable] of ports) await assertPortFree(port, variable);
  const start = async (spec: ProcessSpec, url: string) => {
    const service = startService(spec);
    services.push(service);
    await waitForHttp(service, url);
  };
  await start(nodeApp("server", serverEnv(config)), `${config.urls.api}/ready`);
  await start(
    nodeApp("worker", workerEnv(config)),
    `http://127.0.0.1:${String(config.ports.workerHealth)}/health`,
  );
  await start(
    {
      label: "admin",
      command: join(REPO_ROOT, "apps/admin/node_modules/.bin/next"),
      args: ["start", "--port", String(config.ports.admin)],
      cwd: join(REPO_ROOT, "apps/admin"),
      env: adminEnv(config),
    },
    `${config.urls.admin}/sign-in`,
  );
  await start(
    {
      label: "mobile-web",
      command: process.execPath,
      args: ["src/scripts/serve-static.ts"],
      cwd: E2E_DIR,
      env: { E2E_STATIC_PORT: String(config.ports.web), E2E_API_UPSTREAM: config.urls.api },
    },
    config.urls.mobileWeb,
  );
}
