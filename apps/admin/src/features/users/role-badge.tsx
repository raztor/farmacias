"use client";

import { ROLES, type Role } from "@repo/shared";
import { Text, cn } from "@repo/ui";

import { roleLabel } from "./users-format";

/** Pill with the user's role (text label, never color only). */
export function RoleBadge({ role }: Readonly<{ role: Role }>) {
  return (
    <Text
      className={cn(
        "self-start rounded-full px-2.5 py-0.5 text-xs font-semibold",
        role === ROLES.resident
          ? "bg-secondary text-secondary-foreground"
          : "bg-primary text-primary-foreground",
      )}
    >
      {roleLabel(role)}
    </Text>
  );
}
