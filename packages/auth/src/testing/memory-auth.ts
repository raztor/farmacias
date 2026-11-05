import { DEFAULT_ROLE, type Role, ROLES } from "@repo/shared";
import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { admin } from "better-auth/plugins";

import { accessControl, AUTH_ROLES } from "../access-control";
import { authHttpAllowlist } from "../http-allowlist";
import { signInAccountLimit } from "../sign-in-account-limit";

/**
 * Test-only Better Auth instance with the SAME plugins and roles as `createAuth`, persisted in
 * memory so the HTTP flows (sign-in, admin endpoints, rate limits) run without PostgreSQL.
 */

export const TEST_BASE_URL = "http://localhost:4000";
export const TEST_ORIGIN = "http://localhost:3001";
export const TEST_PASSWORD = "clave-sintetica-123";

export type MemoryAuthOptions = {
  rateLimited?: boolean;
  accountRule?: { window: number; max: number };
};

export const createMemoryAuth = (options: MemoryAuthOptions = {}) => {
  const db: Record<string, Record<string, unknown>[]> = {
    user: [],
    session: [],
    account: [],
    verification: [],
    rateLimit: [],
  };
  const auth = betterAuth({
    secret: "test-secret-with-at-least-32-characters!!",
    baseURL: TEST_BASE_URL,
    trustedOrigins: [TEST_ORIGIN],
    database: memoryAdapter(db),
    emailAndPassword: { enabled: true, disableSignUp: true },
    rateLimit: { enabled: options.rateLimited ?? false, storage: "database" },
    logger: { disabled: true },
    telemetry: { enabled: false },
    plugins: [
      authHttpAllowlist(),
      signInAccountLimit(options.accountRule),
      admin({
        ac: accessControl,
        roles: AUTH_ROLES,
        defaultRole: DEFAULT_ROLE,
        adminRoles: [ROLES.admin],
      }),
    ],
  });
  return { auth, db };
};

export type MemoryAuth = ReturnType<typeof createMemoryAuth>["auth"];

type PostOptions = { cookie?: string; forwardedFor?: string };

/** `POST /api/auth/<path>` with a JSON body, from the trusted admin origin. */
export const postJson = (
  auth: MemoryAuth,
  path: string,
  body: unknown,
  options: PostOptions = {},
) =>
  auth.handler(
    new Request(`${TEST_BASE_URL}/api/auth${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: TEST_ORIGIN,
        "x-forwarded-for": options.forwardedFor ?? "203.0.113.1",
        ...(options.cookie === undefined ? {} : { cookie: options.cookie }),
      },
      body: JSON.stringify(body),
    }),
  );

/** Creates an account server side (like the seed) and returns its session cookie. */
export const signedInAs = async (auth: MemoryAuth, role: Role): Promise<string> => {
  const email = `${role}@demo.farmacia.cl`;
  await auth.api.createUser({ body: { email, password: TEST_PASSWORD, name: role, role } });
  const response = await postJson(auth, "/sign-in/email", { email, password: TEST_PASSWORD });
  if (!response.ok) throw new Error(`Sign-in failed with HTTP ${String(response.status)}`);
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .join("; ");
};
