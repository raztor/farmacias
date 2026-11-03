"use client";

import { ROLE_LABELS, ROLE_VALUES, isRole } from "@repo/shared";
import { Text } from "@repo/ui";
import type { ChangeEvent } from "react";

import { useSetRole } from "./use-set-role";
import type { AdminUser } from "./users-cache";

type RoleSelectProps = Readonly<{ user: AdminUser; isCurrentUser: boolean }>;

/**
 * Assigns one of the three roles (persona inscrita, operario, administrador). Not offered for
 * the signed-in admin: the API forbids removing your own admin role.
 */
export function RoleSelect({ user, isCurrentUser }: RoleSelectProps) {
  const setRole = useSetRole();

  if (isCurrentUser) {
    return (
      <Text variant="muted" className="text-xs">
        Tu cuenta
      </Text>
    );
  }

  const onChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const role = event.target.value;
    if (isRole(role) && role !== user.role) setRole.mutate({ userId: user.id, role });
  };

  return (
    <select
      aria-label={`Rol de ${user.name}`}
      value={user.role}
      disabled={setRole.isPending}
      onChange={onChange}
      className="rounded-md border border-input bg-background px-2 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
    >
      {ROLE_VALUES.map((role) => (
        <option key={role} value={role}>
          {ROLE_LABELS[role]}
        </option>
      ))}
    </select>
  );
}
