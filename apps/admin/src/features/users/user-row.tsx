"use client";

import { Text } from "@repo/ui";

import { RoleBadge } from "./role-badge";
import { RoleToggle } from "./role-toggle";
import type { AdminUser } from "./users-cache";
import { formatUserDate } from "./users-format";

type UserRowProps = Readonly<{ user: AdminUser; isCurrentUser: boolean }>;

function UserStatus({ user }: Readonly<{ user: AdminUser }>) {
  if (user.banned) return <Text className="text-sm text-destructive">Suspendido</Text>;
  if (!user.emailVerified) return <Text variant="muted">Sin verificar</Text>;
  return <Text className="text-sm text-success">Verificado</Text>;
}

/** One user of the backoffice table. */
export function UserRow({ user, isCurrentUser }: UserRowProps) {
  return (
    <tr className="border-t border-border align-middle">
      <td className="px-4 py-3">
        <div className="flex flex-col">
          <Text className="font-medium">{user.name}</Text>
          <Text variant="muted">{user.email}</Text>
        </div>
      </td>
      <td className="px-4 py-3">
        <RoleBadge role={user.role} />
      </td>
      <td className="hidden px-4 py-3 md:table-cell">
        <UserStatus user={user} />
      </td>
      <td className="hidden px-4 py-3 sm:table-cell">
        <Text variant="muted">{formatUserDate(user.createdAt)}</Text>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-row justify-end">
          <RoleToggle user={user} isCurrentUser={isCurrentUser} />
        </div>
      </td>
    </tr>
  );
}
