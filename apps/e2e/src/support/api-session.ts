import { randomUUID } from "node:crypto";

import type { APIRequest, APIRequestContext } from "@playwright/test";

import { E2E_ACCOUNTS, E2E_RESIDENT_PASSWORD, E2E_URLS } from "./env.ts";
import { createTrpcClient, isRecord, type TrpcClient } from "./trpc-http.ts";

/**
 * Authenticated API clients for test data setup. Better Auth checks the `Origin` of every POST
 * against `TRUSTED_ORIGINS`, so the requests present the admin origin (always trusted by the
 * E2E stack). The session cookie stays in the request context.
 */

export type Credentials = Readonly<{ email: string; password: string }>;

export type ApiSession = Readonly<{
  trpc: TrpcClient;
  request: APIRequestContext;
  dispose: () => Promise<void>;
}>;

const newApiContext = (factory: APIRequest): Promise<APIRequestContext> =>
  factory.newContext({
    baseURL: E2E_URLS.api,
    extraHTTPHeaders: { origin: E2E_URLS.admin },
  });

const toSession = (context: APIRequestContext): ApiSession => ({
  trpc: createTrpcClient(context),
  request: context,
  dispose: () => context.dispose(),
});

/** Anonymous API client (public procedures such as `catalog.*`). */
export async function anonymousApi(factory: APIRequest): Promise<ApiSession> {
  return toSession(await newApiContext(factory));
}

/** Signs in through Better Auth (`POST /api/auth/sign-in/email`) and keeps the cookie. */
export async function signedInApi(
  factory: APIRequest,
  credentials: Credentials,
): Promise<ApiSession> {
  const context = await newApiContext(factory);
  const response = await context.post("/api/auth/sign-in/email", { data: credentials });
  if (!response.ok()) {
    await context.dispose();
    throw new Error(
      `Sign-in of ${credentials.email} failed with HTTP ${String(response.status())}. ` +
        "Is the E2E stack running and seeded? (pnpm --filter @repo/e2e e2e:stack)",
    );
  }
  return toSession(context);
}

export const adminApi = (factory: APIRequest): Promise<ApiSession> =>
  signedInApi(factory, E2E_ACCOUNTS.admin);

export const operatorApi = (factory: APIRequest): Promise<ApiSession> =>
  signedInApi(factory, E2E_ACCOUNTS.operator);

/**
 * Creates a throwaway resident account (public sign-up is disabled, so the seed admin creates
 * it with the Better Auth admin plugin). One per test: a resident has at most one draft order,
 * so sharing accounts would make tests depend on each other. Synthetic data only (RNF-06).
 * No `role` is sent: the admin role lacks `user:set-role`, so the endpoint only creates accounts
 * with the default `resident` role (R-ACC-08).
 */
export async function createResident(admin: ApiSession, label: string): Promise<Credentials> {
  const email = `e2e-${randomUUID()}@demo.farmacia.cl`;
  const response = await admin.request.post("/api/auth/admin/create-user", {
    data: {
      email,
      password: E2E_RESIDENT_PASSWORD,
      name: `Residente E2E ${label}`,
    },
  });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok() || !isRecord(body) || !isRecord(body.user)) {
    throw new Error(`Could not create the resident ${email}: HTTP ${String(response.status())}`);
  }
  return { email, password: E2E_RESIDENT_PASSWORD };
}
