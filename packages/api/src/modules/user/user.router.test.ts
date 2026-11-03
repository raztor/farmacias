import { TRPCError } from "@trpc/server";
import { describe, expect, it, vi } from "vitest";

import { createCaller } from "../../root";
import { createRecordingLogger, createTestContext, createTestSession } from "../../testing/fakes";
import { INTERNAL_ERROR_MESSAGE } from "../../trpc";

const session = createTestSession({ id: "user-1", role: "user" });

const row = {
  id: "user-1",
  email: "ana@example.com",
  name: "Ana",
  image: null,
  role: "user",
  emailVerified: true,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
};

describe("user router", () => {
  it("rejects anonymous callers with UNAUTHORIZED", async () => {
    const caller = createCaller(await createTestContext());

    await expect(caller.user.me()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.user.updateProfile({ name: "Ana" })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("returns the profile of the signed-in user", async () => {
    const findUnique = vi.fn(() => Promise.resolve(row));
    const caller = createCaller(await createTestContext({ session, db: { user: { findUnique } } }));

    await expect(caller.user.me()).resolves.toEqual({ ...row, role: "user" });
    expect(findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "user-1" } }));
  });

  it("maps the service AppError to a NOT_FOUND TRPCError", async () => {
    const findUnique = vi.fn(() => Promise.resolve(null));
    const caller = createCaller(await createTestContext({ session, db: { user: { findUnique } } }));

    const error = await caller.user.me().catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(TRPCError);
    expect(error).toMatchObject({ code: "NOT_FOUND", message: "No encontramos tu cuenta." });
  });

  it("updates the profile with the validated (trimmed) name", async () => {
    const update = vi.fn(() => Promise.resolve({ ...row, name: "Ana María" }));
    const caller = createCaller(await createTestContext({ session, db: { user: { update } } }));

    await expect(caller.user.updateProfile({ name: "  Ana María  " })).resolves.toMatchObject({
      name: "Ana María",
    });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "user-1" }, data: { name: "Ana María" } }),
    );
  });

  it("rejects invalid input with BAD_REQUEST", async () => {
    const caller = createCaller(await createTestContext({ session }));

    await expect(caller.user.updateProfile({ name: "   " })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  it("maps Prisma's record-not-found on update to NOT_FOUND", async () => {
    const update = vi.fn(() => Promise.reject(Object.assign(new Error("gone"), { code: "P2025" })));
    const caller = createCaller(await createTestContext({ session, db: { user: { update } } }));

    await expect(caller.user.updateProfile({ name: "Ana" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("hides unexpected failures behind a generic INTERNAL_SERVER_ERROR and logs them", async () => {
    const failure = new Error("connection reset by peer 10.0.0.12");
    const findUnique = vi.fn(() => Promise.reject(failure));
    const { logger, entries } = createRecordingLogger();
    const caller = createCaller(
      await createTestContext({ session, logger, db: { user: { findUnique } } }),
    );

    const error = await caller.user.me().catch((caught: unknown) => caught);

    expect(error).toMatchObject({ code: "INTERNAL_SERVER_ERROR", message: INTERNAL_ERROR_MESSAGE });
    expect((error as TRPCError).cause).toBe(failure);
    const logged = entries.find((entry) => entry.level === "error");
    expect(logged?.obj).toMatchObject({ path: "user.me", requestId: "test-request", err: failure });
  });
});
