import { expo } from "@better-auth/expo";
import type { PrismaClient } from "@repo/db";
import {
  APP_NAME,
  type AppLogger,
  noopLogger,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  ROLES,
} from "@repo/shared";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { betterAuth } from "better-auth/minimal";
import { admin } from "better-auth/plugins";

import {
  assertAuthSecret,
  AUTH_COOKIE_PREFIX,
  normalizeBaseURL,
  normalizeTrustedOrigins,
  RATE_LIMIT_MODEL,
  RATE_LIMIT_RULE,
  SESSION_POLICY,
} from "./auth-config";
import { toBetterAuthLogger } from "./auth-logger";
import { createUserCreatedHook, type OnUserCreated } from "./user-created-hook";

export type CreateAuthOptions = {
  /** Prisma client from `@repo/db`. Better Auth persists users, sessions and rate limits with it. */
  db: PrismaClient;
  /** Secret used to sign cookies and tokens (`BETTER_AUTH_SECRET`, 32+ characters). */
  secret: string;
  /** Public URL of the auth server (`BETTER_AUTH_URL`), e.g. `http://localhost:4000`. */
  baseURL: string;
  /** Origins allowed to call the auth endpoints. The mobile scheme `bnp://` is always added. */
  trustedOrigins: readonly string[];
  /** Enables secure cookies and the database-backed rate limiter. */
  isProduction: boolean;
  /** Runs after a user is created. Its errors are logged and never fail the sign-up. */
  onUserCreated?: OnUserCreated | undefined;
  /** Structured logger for Better Auth internals and hook failures. */
  logger?: AppLogger | undefined;
};

/**
 * Creates the Better Auth server instance: email + password, Prisma persistence,
 * `expo()` for the mobile app and `admin()` for roles, bans and impersonation.
 */
export function createAuth(options: CreateAuthOptions) {
  const logger = options.logger ?? noopLogger;
  const afterUserCreated = createUserCreatedHook({
    onUserCreated: options.onUserCreated,
    logger,
  });

  return betterAuth({
    appName: APP_NAME,
    secret: assertAuthSecret(options.secret),
    baseURL: normalizeBaseURL(options.baseURL),
    trustedOrigins: normalizeTrustedOrigins(options.trustedOrigins),
    database: prismaAdapter(options.db, { provider: "postgresql" }),
    emailAndPassword: {
      enabled: true,
      autoSignIn: true,
      minPasswordLength: PASSWORD_MIN_LENGTH,
      maxPasswordLength: PASSWORD_MAX_LENGTH,
    },
    session: {
      expiresIn: SESSION_POLICY.expiresIn,
      updateAge: SESSION_POLICY.updateAge,
      cookieCache: { enabled: true, maxAge: SESSION_POLICY.cookieCacheMaxAge },
    },
    rateLimit: {
      enabled: options.isProduction,
      storage: "database",
      modelName: RATE_LIMIT_MODEL,
      window: RATE_LIMIT_RULE.window,
      max: RATE_LIMIT_RULE.max,
    },
    advanced: {
      useSecureCookies: options.isProduction,
      cookiePrefix: AUTH_COOKIE_PREFIX,
    },
    databaseHooks: {
      user: { create: { after: afterUserCreated } },
    },
    logger: toBetterAuthLogger(logger, options.isProduction),
    telemetry: { enabled: false },
    plugins: [expo(), admin({ defaultRole: ROLES.user, adminRoles: [ROLES.admin] })],
  });
}

/** Better Auth instance returned by {@link createAuth}. */
export type Auth = ReturnType<typeof createAuth>;

/** Session payload (`{ session, user }`) including plugin fields such as `user.role`. */
export type AuthSession = Auth["$Infer"]["Session"];

/** Authenticated user, including the `admin` plugin fields (`role`, `banned`…). */
export type AuthUser = AuthSession["user"];
