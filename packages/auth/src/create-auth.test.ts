import type { PrismaClient } from "@repo/db";
import { type AppLogger, noopLogger, ROLES } from "@repo/shared";
import { describe, expect, expectTypeOf, it, vi } from "vitest";

import { accessControl, AUTH_ROLES } from "./access-control";
import { AuthConfigError } from "./auth-config";
import { type AuthSession, type AuthUser, createAuth, type CreateAuthOptions } from "./create-auth";

const SECRET = "test-secret-with-at-least-32-characters!!";

/** The Prisma adapter is lazy: no query runs while building the instance. */
const fakeDb = {} as PrismaClient;

/** Enough of Prisma for endpoints that open a transaction before failing validation. */
const fakeTransactionalDb = {
  $transaction: (run: (tx: unknown) => Promise<unknown>) => run(fakeDb),
} as unknown as PrismaClient;

function buildAuth(overrides: Partial<CreateAuthOptions> = {}) {
  return createAuth({
    db: fakeDb,
    secret: SECRET,
    baseURL: "http://localhost:4000/",
    trustedOrigins: ["http://localhost:8081", "http://localhost:3001"],
    isProduction: false,
    ...overrides,
  });
}

function createSpyLogger() {
  const error = vi.fn();
  const logger: AppLogger = { ...noopLogger, error, child: () => logger };
  return { logger, error };
}

const createdUser = {
  id: "user_1",
  email: "ana@example.cl",
  name: "Ana",
  emailVerified: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  role: ROLES.resident,
};

describe("createAuth", () => {
  it("enables email and password sign-in with the shared password policy", () => {
    const { emailAndPassword } = buildAuth().options;

    expect(emailAndPassword).toMatchObject({
      enabled: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
    });
  });

  it("disables public sign-up: accounts are preregistered", async () => {
    const auth = buildAuth({ db: fakeTransactionalDb });
    expect(auth.options.emailAndPassword.disableSignUp).toBe(true);

    const response = await auth.handler(
      new Request("http://localhost:4000/api/auth/sign-up/email", {
        method: "POST",
        headers: { "content-type": "application/json", origin: "http://localhost:8081" },
        body: JSON.stringify({ name: "Ana", email: "ana@example.cl", password: "12345678" }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: "EMAIL_PASSWORD_SIGN_UP_DISABLED",
    });
  });

  it("keeps sessions for 30 days, refreshes daily and caches the cookie for 5 minutes", () => {
    const { session } = buildAuth().options;

    expect(session).toEqual({
      expiresIn: 2_592_000,
      updateAge: 86_400,
      cookieCache: { enabled: true, maxAge: 300 },
    });
  });

  it("always trusts the mobile scheme and normalizes the base URL", () => {
    const { trustedOrigins, baseURL } = buildAuth().options;

    expect(baseURL).toBe("http://localhost:4000");
    expect(trustedOrigins).toEqual(["http://localhost:8081", "http://localhost:3001", "bnp://"]);
  });

  it("registers the expo and admin plugins with the application roles", () => {
    const { plugins } = buildAuth().options;
    const adminPlugin = plugins.find((plugin) => plugin.id === "admin");

    expect(plugins.map((plugin) => plugin.id)).toEqual(["expo", "admin"]);
    expect(adminPlugin?.options).toMatchObject({
      defaultRole: "resident",
      adminRoles: ["admin"],
      roles: AUTH_ROLES,
      ac: accessControl,
    });
  });

  it("enables secure cookies and the database rate limiter only in production", () => {
    const development = buildAuth().options;
    const production = buildAuth({ isProduction: true }).options;

    expect(development.advanced).toEqual({ useSecureCookies: false, cookiePrefix: "bnp" });
    expect(development.rateLimit.enabled).toBe(false);
    expect(production.advanced).toEqual({ useSecureCookies: true, cookiePrefix: "bnp" });
    expect(production.rateLimit).toMatchObject({
      enabled: true,
      storage: "database",
      modelName: "rateLimit",
    });
  });

  it("maps rate limits to the RateLimit model of @repo/db", async () => {
    const context = await buildAuth({ isProduction: true }).$context;

    expect(context.tables.rateLimit?.modelName).toBe("rateLimit");
    expect(Object.keys(context.tables.rateLimit?.fields ?? {})).toEqual([
      "key",
      "count",
      "lastRequest",
    ]);
  });

  it("rejects an invalid configuration", () => {
    expect(() => buildAuth({ secret: "short" })).toThrow(AuthConfigError);
    expect(() => buildAuth({ baseURL: "localhost:4000" })).toThrow(AuthConfigError);
  });
});

describe("createAuth user.create.after hook", () => {
  it("passes only the public user fields to onUserCreated", async () => {
    const onUserCreated = vi.fn();
    const hook = buildAuth({ onUserCreated }).options.databaseHooks.user.create.after;

    await hook(createdUser);

    expect(onUserCreated).toHaveBeenCalledExactlyOnceWith({
      id: "user_1",
      email: "ana@example.cl",
      name: "Ana",
    });
  });

  it("logs and swallows errors thrown by onUserCreated", async () => {
    const { logger, error } = createSpyLogger();
    const failure = new Error("queue unavailable");
    const onUserCreated = vi.fn().mockRejectedValue(failure);
    const hook = buildAuth({ onUserCreated, logger }).options.databaseHooks.user.create.after;

    await expect(hook(createdUser)).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledWith(
      { err: failure, userId: "user_1" },
      "onUserCreated hook failed",
    );
  });

  it("is a no-op without onUserCreated", async () => {
    const hook = buildAuth().options.databaseHooks.user.create.after;

    await expect(hook(createdUser)).resolves.toBeUndefined();
  });
});

describe("inferred types", () => {
  it("keeps the admin plugin fields on the session user", () => {
    expectTypeOf<AuthUser>().toEqualTypeOf<AuthSession["user"]>();
    expectTypeOf<AuthSession["user"]>().toHaveProperty("role");
    expectTypeOf<AuthSession["user"]>().toHaveProperty("banned");
    expectTypeOf<AuthSession["user"]>().toHaveProperty("banExpires");
    expectTypeOf<AuthSession["user"]["role"]>().toExtend<string | null | undefined>();
    expectTypeOf<AuthSession["user"]["email"]>().toEqualTypeOf<string>();
    expectTypeOf<AuthSession["session"]>().toHaveProperty("impersonatedBy");
    expectTypeOf<AuthSession["session"]["userId"]>().toEqualTypeOf<string>();
  });

  it("exposes the admin plugin endpoints on the server API", () => {
    const auth = buildAuth();

    expectTypeOf(auth.api).toHaveProperty("setRole");
    expectTypeOf(auth.api).toHaveProperty("listUsers");
    expectTypeOf(auth.api).toHaveProperty("getSession");
    expect(typeof auth.api.setRole).toBe("function");
  });
});
