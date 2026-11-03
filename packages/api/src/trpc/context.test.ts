import { TRPCError } from "@trpc/server";
import type { Auth } from "@repo/auth";
import { describe, expect, expectTypeOf, it, vi } from "vitest";

import { createRecordingLogger, createTestDeps, createTestSession } from "../testing/fakes";
import { createTRPCContext, type SessionResolver } from "./context";

describe("createTRPCContext", () => {
  it("accepts the real Better Auth instance as session resolver", () => {
    expectTypeOf<Auth>().toExtend<SessionResolver>();
  });

  it("resolves the session from the request headers and binds the request id", async () => {
    const session = createTestSession({ id: "user-1", role: "resident" });
    const getSession = vi.fn(() => Promise.resolve(session));
    const { logger, entries } = createRecordingLogger();
    const deps = { ...createTestDeps({ logger }), auth: { api: { getSession } } };
    const headers = new Headers({ cookie: "bnp.session_token=abc" });

    const ctx = await createTRPCContext({ deps, headers, requestId: "req-1" });

    expect(ctx.session).toBe(session);
    expect(ctx.requestId).toBe("req-1");
    expect(ctx.deps).toBe(deps);
    expect(getSession).toHaveBeenCalledWith({ headers, query: { disableCookieCache: true } });
    ctx.logger.info({ probe: true }, "probe");
    expect(entries).toContainEqual(
      expect.objectContaining({ obj: { requestId: "req-1", probe: true } }),
    );
  });

  it("exposes anonymous requests with a null session", async () => {
    const ctx = await createTRPCContext({
      deps: createTestDeps(),
      headers: new Headers(),
      requestId: "req-2",
    });

    expect(ctx.session).toBeNull();
  });

  it("fails with INTERNAL_SERVER_ERROR (not anonymous) when the session lookup fails", async () => {
    const failure = new Error("database unavailable");
    const { logger, entries } = createRecordingLogger();
    const deps = {
      ...createTestDeps({ logger }),
      auth: { api: { getSession: () => Promise.reject(failure) } },
    };

    const error = await createTRPCContext({
      deps,
      headers: new Headers(),
      requestId: "req-3",
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(TRPCError);
    expect(error).toMatchObject({ code: "INTERNAL_SERVER_ERROR", cause: failure });
    expect(entries).toContainEqual(
      expect.objectContaining({ level: "error", obj: { requestId: "req-3", err: failure } }),
    );
  });
});
