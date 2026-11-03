import { updateProfileSchema, type Role } from "@repo/shared";
import type { z } from "zod";

/** Input of `user.updateProfile` (shared with the profile forms). */
export const updateProfileInput = updateProfileSchema;
export type UpdateProfileInput = z.output<typeof updateProfileInput>;

/** Profile of the signed-in user, as returned by `user.me` and `user.updateProfile`. */
export type UserProfile = {
  id: string;
  email: string;
  name: string;
  image: string | null;
  role: Role;
  emailVerified: boolean;
  createdAt: Date;
};
