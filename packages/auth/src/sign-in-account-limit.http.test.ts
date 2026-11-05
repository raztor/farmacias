import { ROLES } from "@repo/shared";
import { describe, expect, it } from "vitest";

import {
  createMemoryAuth,
  type MemoryAuth,
  TEST_BASE_URL,
  TEST_ORIGIN,
  TEST_PASSWORD,
} from "./testing/memory-auth";

/**
 * Two attempts per account and IP: below Better Auth's own per-IP sign-in limit (3 every 10 s),
 * so every 429 below comes from the per-account limit.
 */
const RULE = { window: 60, max: 2 };
const OPERATOR = "operador@demo.farmacia.cl";
const ATTACKER_IP = "198.51.100.66";
const OWNER_IP = "203.0.113.10";

type Attempt = { ip: string; password: string; email?: string; form?: boolean };

const post = (auth: MemoryAuth, ip: string, contentType: string, body: string) =>
  auth.handler(
    new Request(`${TEST_BASE_URL}/api/auth/sign-in/email`, {
      method: "POST",
      headers: { "content-type": contentType, origin: TEST_ORIGIN, "x-forwarded-for": ip },
      body,
    }),
  );

const signIn = (auth: MemoryAuth, { ip, password, email = OPERATOR, form = false }: Attempt) =>
  form
    ? post(
        auth,
        ip,
        "application/x-www-form-urlencoded",
        new URLSearchParams({ email, password }).toString(),
      )
    : post(auth, ip, "application/json", JSON.stringify({ email, password }));

const statusesOf = async (auth: MemoryAuth, attempts: Attempt[]) => {
  const statuses = [];
  for (const attempt of attempts) statuses.push((await signIn(auth, attempt)).status);
  return statuses;
};

const authWithOperator = async (rateLimited = true) => {
  const { auth } = createMemoryAuth({ rateLimited, accountRule: RULE });
  await auth.api.createUser({
    body: { email: OPERATOR, password: TEST_PASSWORD, name: "Op", role: ROLES.operator },
  });
  return auth;
};

const wrong = (ip: string, form = false): Attempt => ({ ip, password: "incorrecta", form });

describe("sign-in over HTTP (R-ACC-09)", () => {
  it("limits guesses per account from the same IP, even with the correct password", async () => {
    const auth = await authWithOperator();

    const statuses = await statusesOf(auth, [wrong(ATTACKER_IP), wrong(ATTACKER_IP)]);
    const blocked = await signIn(auth, { ip: ATTACKER_IP, password: TEST_PASSWORD });

    expect(statuses).toEqual([401, 401]);
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("x-retry-after")).toMatch(/^\d+$/);
  });

  it("never locks the owner out from another IP while an attacker is blocked", async () => {
    const auth = await authWithOperator();
    const attacker = [wrong(ATTACKER_IP), wrong(ATTACKER_IP), wrong(ATTACKER_IP)];

    expect(await statusesOf(auth, attacker)).toEqual([401, 401, 429]);
    expect((await signIn(auth, { ip: OWNER_IP, password: TEST_PASSWORD })).status).toBe(200);
  });

  it("counts form-encoded sign-ins too (Better Auth accepts urlencoded bodies)", async () => {
    const auth = await authWithOperator();
    const attempts = [wrong(ATTACKER_IP, true), wrong(ATTACKER_IP, true), wrong(ATTACKER_IP, true)];

    expect(await statusesOf(auth, attempts)).toEqual([401, 401, 429]);
  });

  it("shares the counter between JSON and form bodies", async () => {
    const auth = await authWithOperator();
    const attempts = [
      wrong(ATTACKER_IP),
      wrong(ATTACKER_IP, true),
      { ip: ATTACKER_IP, password: TEST_PASSWORD, form: true },
    ];

    expect(await statusesOf(auth, attempts)).toEqual([401, 401, 429]);
  });

  it.each([
    ["text/plain", `email=${OPERATOR}&password=x`],
    ["application/json", "{not json"],
    ["application/json", JSON.stringify({ password: "x" })],
    ["application/x-www-form-urlencoded", "password=x"],
    ["application/xml", `<email>${OPERATOR}</email>`],
    [
      "multipart/form-data; boundary=x",
      `--x\r\nContent-Disposition: form-data; name="email"\r\n\r\n${OPERATOR}\r\n--x--`,
    ],
  ])("fails closed (400) when the email of a %s body cannot be read", async (type, body) => {
    const auth = await authWithOperator();

    const response = await post(auth, ATTACKER_IP, type, body);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ code: "INVALID_EMAIL" });
  });

  it("does not limit other accounts from the same IP", async () => {
    const auth = await authWithOperator();
    await statusesOf(auth, [wrong(ATTACKER_IP), wrong(ATTACKER_IP)]);

    const other = await signIn(auth, {
      ip: ATTACKER_IP,
      password: "incorrecta",
      email: "residente1@demo.farmacia.cl",
    });

    expect(other.status).toBe(401);
  });

  it("is off when Better Auth's rate limiting is off (development, tests)", async () => {
    const auth = await authWithOperator(false);

    const statuses = await statusesOf(
      auth,
      Array.from({ length: 5 }, () => wrong(ATTACKER_IP)),
    );

    expect(statuses.every((status) => status === 401)).toBe(true);
  });
});
