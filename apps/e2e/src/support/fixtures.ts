import { test as base, expect, type Page, type TestInfo } from "@playwright/test";

import {
  adminApi,
  anonymousApi,
  createResident,
  operatorApi,
  signedInApi,
  type ApiSession,
  type Credentials,
} from "./api-session.ts";

export type Resident = Credentials & Readonly<{ api: ApiSession }>;

type Fixtures = {
  /** Public API client (catalog). */
  publicApi: ApiSession;
  /** Seed operator, signed in through the API. */
  operator: ApiSession;
  /** Creates a fresh resident account and signs it in through the API. */
  newResident: (label: string) => Promise<Resident>;
};

/**
 * Playwright `test` with API fixtures. Every test creates its own residents and orders, so tests
 * are independent and can run in parallel across browsers (fullyParallel).
 */
export const test = base.extend<Fixtures>({
  publicApi: async ({ playwright }, use) => {
    const api = await anonymousApi(playwright.request);
    await use(api);
    await api.dispose();
  },
  operator: async ({ playwright }, use) => {
    const api = await operatorApi(playwright.request);
    await use(api);
    await api.dispose();
  },
  newResident: async ({ playwright }, use, testInfo) => {
    const admin = await adminApi(playwright.request);
    const created: ApiSession[] = [];
    await use(async (label) => {
      const credentials = await createResident(admin, `${testInfo.project.name} ${label}`);
      const api = await signedInApi(playwright.request, credentials);
      created.push(api);
      return { ...credentials, api };
    });
    await Promise.all([admin, ...created].map((api) => api.dispose()));
  },
});

export { expect };

/**
 * Slot of the running test: its project index, plus the number of projects times the repeat
 * index (`--repeat-each`). Copies of a spec that run at the same time get different slots, so
 * they use different products (see `pickProduct`).
 */
export function projectSlot(testInfo: TestInfo): number {
  const names = testInfo.config.projects.map((project) => project.name);
  const index = Math.max(names.indexOf(testInfo.project.name), 0);
  return index + names.length * testInfo.repeatEachIndex;
}

/** Signs in on the resident app (Expo web) sign-in screen. */
export async function signInOnMobileWeb(page: Page, credentials: Credentials): Promise<void> {
  await page.getByTestId("sign-in-email").fill(credentials.email);
  await page.getByTestId("sign-in-password").fill(credentials.password);
  await page.getByTestId("sign-in-submit").click();
}

/**
 * Opens a resident screen that needs a session; signs in from its prompt, which comes back to
 * the same screen afterwards.
 */
export async function openSignedIn(page: Page, path: string, credentials: Credentials) {
  await page.goto(path);
  await page.getByTestId("sign-in-prompt-button").click();
  await signInOnMobileWeb(page, credentials);
}

/** Signs in on the admin back office (`/sign-in`) and waits to leave the form. */
export async function signInOnAdmin(page: Page, credentials: Credentials): Promise<void> {
  await page.goto("/sign-in");
  await page.getByLabel("Correo electrónico").fill(credentials.email);
  await page.getByLabel("Contraseña").fill(credentials.password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page).not.toHaveURL(/\/sign-in/);
}
