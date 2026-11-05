import { headers } from "next/headers";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getServerSession } from "./session";

vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("../env", () => ({
  getServerEnv: () => ({ NODE_ENV: "test", API_INTERNAL_URL: "http://api.internal:4000" }),
}));

const headersMock = vi.mocked(headers);
const fetchMock = vi.fn<typeof fetch>();

const SESSION_BODY = {
  session: { id: "s1", userId: "u1", expiresAt: "2030-01-01T00:00:00.000Z" },
  user: {
    id: "u1",
    email: "operario@demo.farmacia.cl",
    name: "Operario",
    image: null,
    role: "operator",
    emailVerified: true,
  },
};

const withCookie = (cookie: string | null) => {
  const requestHeaders = new Headers(cookie === null ? {} : { cookie });
  headersMock.mockResolvedValue(requestHeaders);
};

describe("getServerSession", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("bypasses Better Auth's cookie cache so role changes apply on the next request (R-ACC-12)", async () => {
    withCookie("bnp.session_token=t; bnp.session_data=cached");
    fetchMock.mockResolvedValue(Response.json(SESSION_BODY));

    const session = await getServerSession();

    expect(session?.user.role).toBe("operator");
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    const requested = new URL(url instanceof Request ? url.url : (url ?? ""));
    expect(requested.origin + requested.pathname).toBe(
      "http://api.internal:4000/api/auth/get-session",
    );
    expect(requested.searchParams.get("disableCookieCache")).toBe("true");
    expect(new Headers(init?.headers).get("cookie")).toBe(
      "bnp.session_token=t; bnp.session_data=cached",
    );
  });

  it("is signed out without cookies and does not call the API", async () => {
    withCookie(null);

    await expect(getServerSession()).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("is signed out when the API answers 401", async () => {
    withCookie("bnp.session_token=t");
    fetchMock.mockResolvedValue(new Response(null, { status: 401 }));

    await expect(getServerSession()).resolves.toBeNull();
  });

  it("throws on an unexpected status instead of treating the user as signed out", async () => {
    withCookie("bnp.session_token=t");
    fetchMock.mockResolvedValue(new Response(null, { status: 502 }));

    await expect(getServerSession()).rejects.toThrow("HTTP 502");
  });
});
