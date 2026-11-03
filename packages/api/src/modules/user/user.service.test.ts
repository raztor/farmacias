import { AppError } from "@repo/shared";
import { describe, expect, it, vi } from "vitest";

import type { UserRepository } from "./user.repository";
import type { UserProfile } from "./user.schema";
import { createUserService, createUserServiceFromDeps } from "./user.service";

const profile: UserProfile = {
  id: "user-1",
  email: "ana@example.com",
  name: "Ana",
  image: null,
  role: "resident",
  emailVerified: true,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
};

const createRepo = (overrides: Partial<UserRepository> = {}): UserRepository => ({
  findProfileById: vi.fn(() => Promise.resolve(profile)),
  updateName: vi.fn((_id: string, name: string) => Promise.resolve({ ...profile, name })),
  ...overrides,
});

describe("user.service", () => {
  describe("me", () => {
    it("returns the profile of the user", async () => {
      const repo = createRepo();
      const service = createUserService({ repo });

      await expect(service.me("user-1")).resolves.toEqual(profile);
      expect(repo.findProfileById).toHaveBeenCalledWith("user-1");
    });

    it("throws NOT_FOUND when the account no longer exists", async () => {
      const service = createUserService({
        repo: createRepo({ findProfileById: () => Promise.resolve(null) }),
      });

      await expect(service.me("ghost")).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(service.me("ghost")).rejects.toBeInstanceOf(AppError);
    });
  });

  describe("updateProfile", () => {
    it("updates the name and returns the new profile", async () => {
      const repo = createRepo();
      const service = createUserService({ repo });

      await expect(service.updateProfile("user-1", { name: "Ana María" })).resolves.toEqual({
        ...profile,
        name: "Ana María",
      });
      expect(repo.updateName).toHaveBeenCalledWith("user-1", "Ana María");
    });

    it("throws NOT_FOUND when the user does not exist", async () => {
      const service = createUserService({
        repo: createRepo({ updateName: () => Promise.resolve(null) }),
      });

      await expect(service.updateProfile("ghost", { name: "X" })).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
    });

    it("propagates unexpected repository failures", async () => {
      const failure = new Error("connection reset");
      const service = createUserService({
        repo: createRepo({ updateName: () => Promise.reject(failure) }),
      });

      await expect(service.updateProfile("user-1", { name: "X" })).rejects.toBe(failure);
    });
  });

  describe("createUserServiceFromDeps", () => {
    it("reads through the Prisma repository", async () => {
      const findUnique = vi.fn(() => Promise.resolve({ ...profile, role: "admin" }));
      const db = { user: { findUnique } } as unknown as Parameters<
        typeof createUserServiceFromDeps
      >[0]["db"];

      await expect(createUserServiceFromDeps({ db }).me("user-1")).resolves.toEqual({
        ...profile,
        role: "admin",
      });
      expect(findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "user-1" } }));
    });
  });
});
