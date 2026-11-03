/**
 * Configuration shared by the Playwright config, the specs and the stack script
 * (`src/scripts/e2e-stack.ts`). Every value has a default that matches the local stack, so
 * `pnpm --filter @repo/e2e e2e:full` works without exporting anything.
 *
 * The passwords are the SYNTHETIC development values of `apps/server/.env.example`
 * (`SEED_*_PASSWORD`): the stack script seeds the E2E database with them, and the specs sign in
 * with them. They are never real credentials (RNF-06).
 */

const read = (name: string): string | undefined => {
  const value = process.env[name]?.trim();
  return value === undefined || value === "" ? undefined : value;
};

const readPort = (name: string, fallback: number): number => {
  const raw = read(name);
  if (raw === undefined) return fallback;
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`${name} must be a TCP port (1-65535), got "${raw}"`);
  }
  return port;
};

/** Synthetic development passwords (same defaults as `apps/server/.env.example`). */
export const DEFAULT_SEED_PASSWORDS = {
  resident: "Vecino-Demo-2026",
  operator: "Operador-Demo-2026",
  admin: "Admin-Demo-2026",
} as const;

/** Ports of the local E2E stack (override them when the defaults are busy). */
export const E2E_PORTS = {
  api: readPort("E2E_API_PORT", 4000),
  admin: readPort("E2E_ADMIN_PORT", 3001),
  web: readPort("E2E_WEB_PORT", 8081),
  workerHealth: readPort("E2E_WORKER_HEALTH_PORT", 4100),
} as const;

/** Browser-facing URLs (Playwright `baseURL`s) and the API URL used to create test data. */
export const E2E_URLS = {
  api: read("E2E_API_URL") ?? `http://127.0.0.1:${String(E2E_PORTS.api)}`,
  admin: read("E2E_ADMIN_URL") ?? `http://localhost:${String(E2E_PORTS.admin)}`,
  mobileWeb: read("E2E_MOBILE_WEB_URL") ?? `http://localhost:${String(E2E_PORTS.web)}`,
} as const;

/** Preregistered seed accounts (apps/server/src/scripts/seed-accounts.ts). */
export const E2E_ACCOUNTS = {
  admin: {
    email: read("E2E_ADMIN_EMAIL") ?? "admin@demo.farmacia.cl",
    password: read("SEED_ADMIN_PASSWORD") ?? DEFAULT_SEED_PASSWORDS.admin,
  },
  operator: {
    email: read("E2E_OPERATOR_EMAIL") ?? "operador@demo.farmacia.cl",
    password: read("SEED_OPERATOR_PASSWORD") ?? DEFAULT_SEED_PASSWORDS.operator,
  },
} as const;

/** Password of the throwaway resident accounts each test creates (synthetic, test-only). */
export const E2E_RESIDENT_PASSWORD =
  read("SEED_RESIDENT_PASSWORD") ?? DEFAULT_SEED_PASSWORDS.resident;

export const IS_CI = read("CI") !== undefined;

/** Adds the installed Google Chrome and Microsoft Edge to the browser matrix (CI). */
export const E2E_BRANDED_BROWSERS = read("E2E_BRANDED_BROWSERS") === "1";
