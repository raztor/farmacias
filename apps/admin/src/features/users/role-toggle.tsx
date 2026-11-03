"use client";

import { ROLES } from "@repo/shared";
import { Button, Text } from "@repo/ui";

import { useSetRole } from "./use-set-role";
import type { AdminUser } from "./users-cache";

type RoleToggleProps = Readonly<{ user: AdminUser; isCurrentUser: boolean }>;

/**
 * Grants or revokes the `admin` role. Disabled for the signed-in admin (the API forbids
 * removing your own role, so the button is never offered).
 */
export function RoleToggle({ user, isCurrentUser }: RoleToggleProps) {
  const setRole = useSetRole();
  const isAdmin = user.role === ROLES.admin;

  if (isCurrentUser) {
    return (
      <Text variant="muted" className="text-xs">
        Tu cuenta
      </Text>
    );
  }

  return (
    <Button
      size="sm"
      variant={isAdmin ? "outline" : "secondary"}
      loading={setRole.isPending}
      accessibilityLabel={
        isAdmin
          ? `Quitar rol de administrador a ${user.name}`
          : `Dar rol de administrador a ${user.name}`
      }
      onPress={() => {
        setRole.mutate({ userId: user.id, role: isAdmin ? ROLES.user : ROLES.admin });
      }}
    >
      {isAdmin ? "Quitar admin" : "Hacer admin"}
    </Button>
  );
}
