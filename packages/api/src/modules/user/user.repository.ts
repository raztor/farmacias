import type { PrismaClient } from "@repo/db";
import { toRole } from "@repo/shared";

import { isRecordNotFoundError } from "../../lib/prisma-errors";
import type { UserProfile } from "./user.schema";

export type UserRepository = {
  findProfileById: (id: string) => Promise<UserProfile | null>;
  /** Returns `null` when the user does not exist. */
  updateName: (id: string, name: string) => Promise<UserProfile | null>;
};

const PROFILE_SELECT = {
  id: true,
  email: true,
  name: true,
  image: true,
  role: true,
  emailVerified: true,
  createdAt: true,
} as const;

type ProfileRow = Omit<UserProfile, "role"> & { role: string | null };

const toProfile = (row: ProfileRow): UserProfile => ({ ...row, role: toRole(row.role) });

export const createUserRepository = (db: PrismaClient): UserRepository => ({
  findProfileById: async (id) => {
    const row = await db.user.findUnique({ where: { id }, select: PROFILE_SELECT });
    return row ? toProfile(row) : null;
  },

  updateName: async (id, name) => {
    try {
      const row = await db.user.update({ where: { id }, data: { name }, select: PROFILE_SELECT });
      return toProfile(row);
    } catch (error) {
      if (isRecordNotFoundError(error)) return null;
      throw error;
    }
  },
});
