import { AppError } from "@repo/shared";

import type { ApiDependencies } from "../../trpc";
import { createUserRepository, type UserRepository } from "./user.repository";
import type { UpdateProfileInput, UserProfile } from "./user.schema";

export type UserServiceDeps = {
  repo: UserRepository;
};

export type UserService = {
  /** Profile of the given user. Throws NOT_FOUND if the account no longer exists. */
  me: (userId: string) => Promise<UserProfile>;
  updateProfile: (userId: string, input: UpdateProfileInput) => Promise<UserProfile>;
};

const userNotFound = (): AppError => new AppError("NOT_FOUND", "No encontramos tu cuenta.");

export const createUserService = ({ repo }: UserServiceDeps): UserService => ({
  me: async (userId) => {
    const profile = await repo.findProfileById(userId);
    if (!profile) throw userNotFound();
    return profile;
  },

  updateProfile: async (userId, input) => {
    const profile = await repo.updateName(userId, input.name);
    if (!profile) throw userNotFound();
    return profile;
  },
});

/** Wires the service to its Prisma repository. */
export const createUserServiceFromDeps = ({ db }: Pick<ApiDependencies, "db">): UserService =>
  createUserService({ repo: createUserRepository(db) });
