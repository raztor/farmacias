import type { PrismaClient } from "@repo/db";
import { ROLES } from "@repo/shared";
import { describe, expect, it } from "vitest";

import { createAuth } from "./create-auth";
import { AUTH_HTTP_PATHS, isAuthHttpPath, toAuthPath } from "./http-allowlist";
import { createMemoryAuth, postJson, signedInAs, TEST_ORIGIN } from "./testing/memory-auth";

const BASE_URL = "http://localhost:4000/api/auth";

describe("toAuthPath", () => {
  it.each([
    ["http://h/api/auth/sign-in/email", "/sign-in/email"],
    ["http://h/api/auth/sign-in/email/?redirect=1", "/sign-in/email"],
    ["http://h/api/auth/admin/set-role", "/admin/set-role"],
    ["http://h/api/auth//admin/set-role", "//admin/set-role"],
    ["http://h/api/auth", "/"],
    ["http://h/api/authx/sign-out", "/api/authx/sign-out"],
  ])("%s → %s", (url, expected) => {
    expect(toAuthPath(url, BASE_URL)).toBe(expected);
  });
});

describe("isAuthHttpPath", () => {
  it("allows only the endpoints the apps use", () => {
    expect(AUTH_HTTP_PATHS).toEqual([
      "/sign-in/email",
      "/sign-out",
      "/get-session",
      "/sign-up/email",
      "/admin/create-user",
    ]);
    for (const path of ["/admin/set-role", "/update-user", "/expo-authorization-proxy", "/ok"]) {
      expect(isAuthHttpPath(path)).toBe(false);
    }
  });
});

/**
 * The real `createAuth` instance (rate limiting off: it needs the database). Blocked paths answer
 * before routing, so no endpoint touches the fake database.
 */
const appAuth = createAuth({
  db: {} as PrismaClient,
  secret: "test-secret-with-at-least-32-characters!!",
  baseURL: "http://localhost:4000",
  trustedOrigins: [TEST_ORIGIN],
  isProduction: false,
});

const callAppAuth = (method: "GET" | "POST", path: string) =>
  appAuth.handler(
    new Request(`${BASE_URL}${path}`, {
      method,
      headers: { "content-type": "application/json", origin: TEST_ORIGIN },
      ...(method === "POST" ? { body: JSON.stringify({ userId: "u1", role: "admin" }) } : {}),
    }),
  );

describe("createAuth over HTTP", () => {
  it.each([
    ["POST", "/admin/set-role"],
    ["POST", "/admin/update-user"],
    ["POST", "/admin/remove-user"],
    ["POST", "/admin/impersonate-user"],
    ["POST", "/admin/set-user-password"],
    ["POST", "/admin/ban-user"],
    ["GET", "/admin/list-users"],
    ["GET", "/admin/get-user?id=u1"],
    ["POST", "/update-user"],
    ["POST", "/change-email"],
    ["POST", "/delete-user"],
    ["GET", "/list-sessions"],
  ] as const)("%s %s answers 404", async (method, path) => {
    const response = await callAppAuth(method, path);

    expect(response.status).toBe(404);
  });

  it("does not expose the Expo OAuth proxy as an open redirect", async () => {
    const target = encodeURIComponent("https://evil.example/login?state=x");
    const response = await callAppAuth(
      "GET",
      `/expo-authorization-proxy?authorizationURL=${target}`,
    );

    expect(response.status).toBe(404);
    expect(response.headers.get("location")).toBeNull();
  });
});

describe("admin endpoints with an admin session", () => {
  it("refuses role changes outside the audited tRPC admin.setRole (R-ACC-08)", async () => {
    const { auth, db } = createMemoryAuth();
    const cookie = await signedInAs(auth, ROLES.admin);
    const adminId = db.user?.[0]?.id;

    const setRole = await postJson(
      auth,
      "/admin/set-role",
      { userId: adminId, role: "resident" },
      { cookie },
    );
    const updateUser = await postJson(
      auth,
      "/admin/update-user",
      { userId: adminId, data: { role: "resident" } },
      { cookie },
    );

    expect(setRole.status).toBe(404);
    expect(updateUser.status).toBe(404);
    expect(db.user?.[0]?.role).toBe(ROLES.admin);
  });

  it("lets an admin create only resident accounts", async () => {
    const { auth, db } = createMemoryAuth();
    const cookie = await signedInAs(auth, ROLES.admin);
    const account = {
      email: "nuevo@demo.farmacia.cl",
      password: "clave-sintetica-1",
      name: "Nuevo",
    };

    const asAdmin = await postJson(
      auth,
      "/admin/create-user",
      { ...account, role: ROLES.admin },
      { cookie },
    );
    const viaData = await postJson(
      auth,
      "/admin/create-user",
      { ...account, data: { role: ROLES.operator } },
      { cookie },
    );
    const plain = await postJson(auth, "/admin/create-user", account, { cookie });

    expect(asAdmin.status).toBe(403);
    expect(viaData.status).toBe(403);
    expect(plain.status).toBe(200);
    expect(db.user?.find((user) => user.email === account.email)?.role).toBe(ROLES.resident);
  });

  it("refuses account creation to operators and residents", async () => {
    const { auth } = createMemoryAuth();
    const account = { email: "otro@demo.farmacia.cl", password: "clave-sintetica-1", name: "Otro" };

    for (const role of [ROLES.operator, ROLES.resident]) {
      const cookie = await signedInAs(auth, role);
      const response = await postJson(auth, "/admin/create-user", account, { cookie });
      expect(response.status).toBe(403);
    }
  });
});
