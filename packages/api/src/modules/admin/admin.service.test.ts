import { describe, expect, it, vi } from "vitest";

import { createRecordingLogger } from "../../testing/fakes";
import type { AdminRepository, RoleChange } from "./admin.repository";
import type { AdminUser } from "./admin.schema";
import { createAdminService, createAdminServiceFromDeps } from "./admin.service";

const NOW = new Date("2026-03-10T12:00:00.000Z");

const user = (id: string, overrides: Partial<AdminUser> = {}): AdminUser => ({
  id,
  email: `${id}@example.com`,
  name: `User ${id}`,
  image: null,
  role: "resident",
  emailVerified: true,
  banned: false,
  createdAt: NOW,
  ...overrides,
});

const createRepo = (overrides: Partial<AdminRepository> = {}): AdminRepository => ({
  countUsers: vi.fn((filter?: { createdSince?: Date }) => Promise.resolve(filter ? 3 : 42)),
  countActiveSessions: vi.fn(() => Promise.resolve(7)),
  listUsers: vi.fn(() => Promise.resolve([])),
  updateRole: vi.fn(({ userId, role }: RoleChange) =>
    Promise.resolve({ user: user(userId, { role }), previousRole: "resident" as const }),
  ),
  ...overrides,
});

describe("admin.service", () => {
  describe("stats", () => {
    it("aggregates totals, users of the last 7 days and active sessions", async () => {
      const repo = createRepo();
      const service = createAdminService({ repo, now: () => NOW });

      await expect(service.stats()).resolves.toEqual({
        totalUsers: 42,
        newUsersLast7Days: 3,
        activeSessions: 7,
      });
      expect(repo.countUsers).toHaveBeenCalledWith({
        createdSince: new Date("2026-03-03T12:00:00.000Z"),
      });
      expect(repo.countActiveSessions).toHaveBeenCalledWith(NOW);
    });
  });

  describe("listUsers", () => {
    it("asks for one extra row and returns a cursor when there are more pages", async () => {
      const rows = [user("u3"), user("u2"), user("u1")];
      const repo = createRepo({ listUsers: vi.fn(() => Promise.resolve(rows)) });
      const service = createAdminService({ repo });

      const page = await service.listUsers({ limit: 2, search: "ana", cursor: "u4" });

      expect(repo.listUsers).toHaveBeenCalledWith({ take: 3, cursor: "u4", search: "ana" });
      expect(page.items.map((item) => item.id)).toEqual(["u3", "u2"]);
      expect(page.nextCursor).toBe("u2");
    });

    it("returns a null cursor on the last page", async () => {
      const rows = [user("u2"), user("u1")];
      const service = createAdminService({
        repo: createRepo({ listUsers: () => Promise.resolve(rows) }),
      });

      await expect(service.listUsers({ limit: 2 })).resolves.toEqual({
        items: rows,
        nextCursor: null,
      });
    });

    it("handles an empty result", async () => {
      const service = createAdminService({ repo: createRepo() });

      await expect(service.listUsers({ limit: 20 })).resolves.toEqual({
        items: [],
        nextCursor: null,
      });
    });
  });

  describe("setRole", () => {
    const actor = { actorId: "admin-1", actorRole: "admin" } as const;

    it.each(["resident", "operator", "admin"] as const)(
      "changes the role of another user to %s and logs it",
      async (role) => {
        const repo = createRepo();
        const { logger, entries } = createRecordingLogger();
        const service = createAdminService({ repo, logger });

        const updated = await service.setRole({ ...actor, userId: "u1", role });

        expect(updated.role).toBe(role);
        expect(repo.updateRole).toHaveBeenCalledWith({ ...actor, userId: "u1", role });
        expect(entries).toContainEqual(
          expect.objectContaining({
            level: "info",
            obj: { actorId: "admin-1", userId: "u1", role, previousRole: "resident" },
          }),
        );
      },
    );

    it.each(["resident", "operator"] as const)(
      "forbids an admin from demoting themselves to %s",
      async (role) => {
        const repo = createRepo();
        const service = createAdminService({ repo });

        await expect(service.setRole({ ...actor, userId: "admin-1", role })).rejects.toMatchObject({
          code: "FORBIDDEN",
        });
        expect(repo.updateRole).not.toHaveBeenCalled();
      },
    );

    it("allows an admin to re-assign their own admin role (no-op)", async () => {
      const service = createAdminService({ repo: createRepo() });

      await expect(
        service.setRole({ ...actor, userId: "admin-1", role: "admin" }),
      ).resolves.toMatchObject({ id: "admin-1", role: "admin" });
    });

    it("throws NOT_FOUND when the target user does not exist", async () => {
      const service = createAdminService({
        repo: createRepo({ updateRole: () => Promise.resolve(null) }),
      });

      await expect(
        service.setRole({ ...actor, userId: "ghost", role: "admin" }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
  });

  describe("createAdminServiceFromDeps", () => {
    it("reads through the Prisma repository", async () => {
      const count = vi.fn(() => Promise.resolve(5));
      const db = { user: { count }, session: { count } } as unknown as Parameters<
        typeof createAdminServiceFromDeps
      >[0]["db"];

      const stats = await createAdminServiceFromDeps(
        { db },
        createRecordingLogger().logger,
      ).stats();

      expect(stats).toEqual({ totalUsers: 5, newUsersLast7Days: 5, activeSessions: 5 });
    });
  });
});
