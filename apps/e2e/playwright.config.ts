import { type PlaywrightTestConfig, defineConfig, devices } from "@playwright/test";

/**
 * Browser E2E tests of the web clients (docs/REPO_RULES.md §8).
 *
 * Projects:
 * - `admin`: Next.js backoffice (`apps/admin`), `E2E_ADMIN_URL` (default http://localhost:3001).
 * - `mobile-web`: web build of the Expo app (`apps/mobile`), `E2E_MOBILE_WEB_URL`
 *   (default http://localhost:8081, the `expo start --web` dev server).
 *
 * By default the apps must already be running. `E2E_START_SERVERS=1` lets Playwright start them:
 * `next start` for admin (run `next build` first) and `src/scripts/serve-static.ts` for the Expo
 * web export (run `pnpm --filter @repo/mobile export:web` first). Running servers are reused
 * outside CI.
 */

const isCI = process.env.CI !== undefined && process.env.CI !== "";
const startServers = process.env.E2E_START_SERVERS === "1";

const ADMIN_URL = process.env.E2E_ADMIN_URL ?? "http://localhost:3001";
const MOBILE_WEB_URL = process.env.E2E_MOBILE_WEB_URL ?? "http://localhost:8081";

type WebServer = Extract<NonNullable<PlaywrightTestConfig["webServer"]>, unknown[]>[number];

const SERVER_DEFAULTS = {
  // Commands are relative to this workspace, wherever Playwright is launched from.
  cwd: import.meta.dirname,
  reuseExistingServer: !isCI,
  timeout: 120_000,
  stdout: "ignore",
  stderr: "pipe",
} as const satisfies Partial<WebServer>;

const webServers: WebServer[] = [
  {
    ...SERVER_DEFAULTS,
    name: "admin",
    command: "pnpm --filter @repo/admin start",
    url: `${ADMIN_URL}/sign-in`,
    env: { SKIP_ENV_VALIDATION: "1" },
  },
  {
    ...SERVER_DEFAULTS,
    name: "mobile-web",
    command: "node src/scripts/serve-static.ts",
    url: MOBILE_WEB_URL,
    env: { E2E_STATIC_PORT: new URL(MOBILE_WEB_URL).port || "80" },
  },
];

export default defineConfig({
  testDir: "./src",
  testMatch: "**/*.spec.ts",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  ...(isCI ? { workers: 1 } : {}),
  reporter: isCI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  use: {
    locale: "es-CL",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "admin",
      testDir: "./src/admin",
      use: { ...devices["Desktop Chrome"], baseURL: ADMIN_URL },
    },
    {
      name: "mobile-web",
      testDir: "./src/mobile-web",
      use: { ...devices["Pixel 7"], baseURL: MOBILE_WEB_URL },
    },
  ],
  ...(startServers ? { webServer: webServers } : {}),
});
