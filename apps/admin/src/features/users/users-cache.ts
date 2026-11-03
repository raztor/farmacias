import type { RouterOutputs } from "@repo/api";
import type { Role } from "@repo/shared";
import type { InfiniteData } from "@tanstack/react-query";

export type AdminUser = RouterOutputs["admin"]["listUsers"]["items"][number];

export type UsersPage = RouterOutputs["admin"]["listUsers"];

export type UsersInfiniteData = InfiniteData<UsersPage, string | null>;

/** Returns `data` with the user `userId` transformed by `update` (other rows untouched). */
export function updateUserInPages(
  data: UsersInfiniteData,
  userId: string,
  update: (user: AdminUser) => AdminUser,
): UsersInfiniteData {
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      items: page.items.map((user) => (user.id === userId ? update(user) : user)),
    })),
  };
}

/** Optimistic role change of a cached user. */
export function withUserRole(data: UsersInfiniteData, userId: string, role: Role) {
  return updateUserInPages(data, userId, (user) => ({ ...user, role }));
}

/** Replaces a cached user with the row returned by the API. */
export function withUser(data: UsersInfiniteData, updated: AdminUser) {
  return updateUserInPages(data, updated.id, () => updated);
}

/** Current role of a cached user, if it is loaded. */
export function findUserRole(data: UsersInfiniteData | undefined, userId: string): Role | null {
  for (const page of data?.pages ?? []) {
    const user = page.items.find((item) => item.id === userId);
    if (user !== undefined) return user.role;
  }
  return null;
}
