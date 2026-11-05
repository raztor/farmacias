/**
 * Process helpers of the E2E stack script: one-shot steps (migrate, seed, builds) and long-lived
 * services (API, worker, admin, web). Output goes to one log file per process under
 * `apps/e2e/.cache/stack-logs/` (git-ignored) so the terminal only shows progress.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { createWriteStream, mkdirSync, readFileSync } from "node:fs";
import { createServer } from "node:net";
import { join } from "node:path";

export const LOG_DIR = join(import.meta.dirname, "../../.cache/stack-logs");

export type ProcessSpec = Readonly<{
  /** Short name, also the log file name. */
  label: string;
  command: string;
  args: readonly string[];
  cwd: string;
  /** Added to the current environment. */
  env?: Readonly<Record<string, string>>;
}>;

export const log = (message: string): void => {
  process.stdout.write(`[e2e-stack] ${message}\n`);
};

const logFileOf = (label: string): string => join(LOG_DIR, `${label}.log`);

const tailOf = (label: string, lines = 40): string => {
  try {
    return readFileSync(logFileOf(label), "utf8").trimEnd().split("\n").slice(-lines).join("\n");
  } catch {
    return "(sin log)";
  }
};

function spawnLogged(spec: ProcessSpec, detached: boolean): ChildProcess {
  mkdirSync(LOG_DIR, { recursive: true });
  const out = createWriteStream(logFileOf(spec.label), { flags: "w" });
  const child = spawn(spec.command, spec.args, {
    cwd: spec.cwd,
    env: { ...process.env, ...spec.env },
    stdio: ["ignore", "pipe", "pipe"],
    // Own process group, so `stopService` also stops the grandchildren (pnpm → node).
    detached,
  });
  child.stdout.pipe(out);
  child.stderr.pipe(out);
  return child;
}

/** Runs a step to completion; on failure prints the end of its log and throws. */
export async function runStep(spec: ProcessSpec): Promise<void> {
  log(`→ ${spec.label}`);
  const startedAt = Date.now();
  const child = spawnLogged(spec, false);
  const code = await new Promise<number | null>((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", resolve);
  });
  if (code !== 0) {
    process.stderr.write(`${tailOf(spec.label)}\n`);
    throw new Error(`${spec.label} failed (exit ${String(code)}), log: ${logFileOf(spec.label)}`);
  }
  log(`✓ ${spec.label} (${String(Math.round((Date.now() - startedAt) / 1000))} s)`);
}

/** Like {@link runStep} but resolves `false` instead of throwing (used to probe commands). */
export async function tryStep(spec: ProcessSpec): Promise<boolean> {
  const child = spawnLogged(spec, false);
  return new Promise<boolean>((resolve) => {
    child.once("error", () => {
      resolve(false);
    });
    child.once("exit", (code) => {
      resolve(code === 0);
    });
  });
}

/**
 * Fails when something already listens on `port` (any interface): otherwise the readiness check
 * could pass against another program while our service dies with EADDRINUSE.
 */
export async function assertPortFree(port: number, variable: string): Promise<void> {
  const free = await new Promise<boolean>((resolve) => {
    const probe = createServer();
    probe.once("error", () => {
      resolve(false);
    });
    probe.listen({ port, host: "::" }, () => {
      probe.close(() => {
        resolve(true);
      });
    });
  });
  if (!free) {
    throw new Error(`Port ${String(port)} is busy: free it or choose another one with ${variable}`);
  }
}

export type Service = Readonly<{ label: string; child: ChildProcess }>;

/** Starts a long-lived process in its own process group. */
export function startService(spec: ProcessSpec): Service {
  log(`↑ ${spec.label}`);
  return { label: spec.label, child: spawnLogged(spec, true) };
}

const isRunning = (service: Service): boolean =>
  service.child.exitCode === null && service.child.signalCode === null;

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const answers = async (url: string): Promise<boolean> => {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(2_000) });
    return response.status < 500;
  } catch {
    return false;
  }
};

/** Waits until `url` answers below HTTP 500, failing early when the service exits. */
export async function waitForHttp(service: Service, url: string, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!isRunning(service)) {
      process.stderr.write(`${tailOf(service.label)}\n`);
      throw new Error(`${service.label} exited before answering ${url}`);
    }
    if (await answers(url)) {
      log(`✓ ${service.label} en ${url}`);
      return;
    }
    await sleep(500);
  }
  throw new Error(`${service.label} did not answer ${url} within ${String(timeoutMs / 1000)} s`);
}

/** Stops a service (SIGTERM to its process group, SIGKILL after 10 s). */
export async function stopService(service: Service): Promise<void> {
  const pid = service.child.pid;
  if (pid === undefined || !isRunning(service)) return;
  const exited = new Promise<void>((resolve) =>
    service.child.once("exit", () => {
      resolve();
    }),
  );
  const signalGroup = (signal: NodeJS.Signals) => {
    try {
      process.kill(-pid, signal);
    } catch {
      // The group is already gone.
    }
  };
  signalGroup("SIGTERM");
  const timer = setTimeout(() => {
    signalGroup("SIGKILL");
  }, 10_000);
  await exited;
  clearTimeout(timer);
}

/** Runs a command attached to this terminal (Playwright) and resolves with its exit code. */
export async function runAttached(spec: ProcessSpec): Promise<number> {
  const child = spawn(spec.command, spec.args, {
    cwd: spec.cwd,
    env: { ...process.env, ...spec.env },
    stdio: "inherit",
  });
  return new Promise<number>((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code) => {
      resolve(code ?? 1);
    });
  });
}
