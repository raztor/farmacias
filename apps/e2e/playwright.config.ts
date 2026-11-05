import { defineConfig, devices, type Project, type ReporterDescription } from "@playwright/test";

import { E2E_BRANDED_BROWSERS, E2E_URLS, IS_CI } from "./src/support/env.ts";

/**
 * Browser E2E tests of the web clients against the full local stack (docs/REPO_RULES.md §8.2,
 * docs/validation/e2e.md). The stack (API, worker, admin, Expo web export, PostgreSQL, Redis)
 * must be running: `pnpm --filter @repo/e2e e2e:full` boots it, runs this suite and stops it;
 * `pnpm --filter @repo/e2e e2e:stack` only boots it (then `pnpm --filter @repo/e2e test:e2e`).
 *
 * Browser matrix (T-12, RNF-03, docs/validation/navegadores.md):
 * - `admin-*`: back office (`apps/admin`, `E2E_ADMIN_URL`, default http://localhost:3001) on
 *   desktop Chromium (Chrome and Edge engine), Firefox and WebKit (Safari engine).
 * - `mobile-web-*`: resident app (web export of `apps/mobile`, `E2E_MOBILE_WEB_URL`, default
 *   http://localhost:8081) on the same three desktop engines plus phone viewports: Pixel 7
 *   (Chrome Android) and iPhone 15 (Safari iOS, WebKit).
 *
 * With `E2E_BRANDED_BROWSERS=1` (CI) both apps also run on the installed Google Chrome and
 * Microsoft Edge (`channel: "chrome" | "msedge"`): `*-chrome` and `*-edge` projects.
 *
 * Pick a subset with `--project`, e.g. `--project=admin-chromium --project=mobile-web-pixel`.
 * Every browser and accessibility project depends on `e2e-setup`, which runs first and takes the
 * product lane snapshot of the run (`src/support/product-lanes.ts`). `e2e-support` holds the
 * self-tests of the support helpers and needs no stack.
 */

const LOCALE = { locale: "es-CL", timezoneId: "America/Santiago" } as const;

/** Takes the product lane snapshot before any spec runs (`src/support/product-lanes.ts`). */
const SETUP_PROJECT = "e2e-setup";

const browserProjects = (
  app: "admin" | "mobile-web",
  baseURL: string,
  targets: Readonly<Record<string, (typeof devices)[string]>>,
): Project[] =>
  Object.entries(targets).map(([target, device]) => ({
    name: `${app}-${target}`,
    testDir: `./src/${app}`,
    dependencies: [SETUP_PROJECT],
    use: { ...device, ...LOCALE, baseURL },
  }));

/**
 * T-09 accessibility audit (RNF-01, RNF-02, docs/validation/accesibilidad.md): axe, keyboard-only
 * flows and 200 % zoom. Desktop Chromium only: axe rules do not depend on the engine and the
 * browser matrix already covers rendering differences (T-12).
 */
const a11yProject = (app: "admin" | "mobile-web", baseURL: string): Project => ({
  name: `a11y-${app}`,
  testDir: `./src/a11y/${app}`,
  dependencies: [SETUP_PROJECT],
  use: { ...devices["Desktop Chrome"], ...LOCALE, baseURL },
});

const BRANDED = {
  chrome: { ...devices["Desktop Chrome"], channel: "chrome" },
  edge: { ...devices["Desktop Edge"], channel: "msedge" },
};

const DESKTOP = {
  chromium: devices["Desktop Chrome"],
  firefox: devices["Desktop Firefox"],
  webkit: devices["Desktop Safari"],
  ...(E2E_BRANDED_BROWSERS ? BRANDED : {}),
};

// The JSON report feeds `src/scripts/matrix-summary.ts` (docs/validation/navegadores.md).
const REPORTERS: ReporterDescription[] = [
  ...(IS_CI ? [["github"] satisfies ReporterDescription] : []),
  ["list"],
  ["html", { open: "never" }],
  ["json", { outputFile: "test-results/results.json" }],
];

export default defineConfig({
  testDir: "./src",
  testMatch: "**/*.spec.ts",
  fullyParallel: true,
  forbidOnly: IS_CI,
  retries: IS_CI ? 1 : 0,
  workers: IS_CI ? 2 : "50%",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: REPORTERS,
  use: {
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [
    ...browserProjects("admin", E2E_URLS.admin, DESKTOP),
    ...browserProjects("mobile-web", E2E_URLS.mobileWeb, {
      ...DESKTOP,
      pixel: devices["Pixel 7"],
      iphone: devices["iPhone 15"],
    }),
    a11yProject("admin", E2E_URLS.admin),
    a11yProject("mobile-web", E2E_URLS.mobileWeb),
    // Last, so the browser projects keep their indexes (`projectSlot`, `PRODUCT_LANES`).
    {
      name: SETUP_PROJECT,
      testDir: "./src/setup",
      testMatch: "**/*.setup.ts",
      use: { ...devices["Desktop Chrome"], ...LOCALE },
    },
    // Self-tests of the support helpers on synthetic pages and fake APIs: no stack needed
    // (`pnpm --filter @repo/e2e test:support`).
    {
      name: "e2e-support",
      testDir: "./src/self-test",
      use: { ...devices["Desktop Chrome"], ...LOCALE },
    },
  ],
});
