"use client";

import { ROLE_LABELS, ROLE_VALUES, type Role } from "@repo/shared";
import { Text } from "@repo/ui";
import { useId, useRef, useState } from "react";

import { buttonClasses } from "../../components/button-link";
import { useSetRole } from "./use-set-role";
import type { AdminUser } from "./users-cache";
import { pendingRoleChange, roleChangePrompt } from "./users-format";

type RoleSelectProps = Readonly<{ user: AdminUser; isCurrentUser: boolean }>;

type RoleChangeConfirmProps = Readonly<{
  id: string;
  prompt: string;
  onSave: () => void;
  onCancel: () => void;
}>;

/** Explicit save step: names the current and the new role before anything is sent. */
function RoleChangeConfirm({ id, prompt, onSave, onCancel }: RoleChangeConfirmProps) {
  return (
    <div className="flex flex-col items-end gap-2">
      <p id={id} className="text-right text-sm text-foreground">
        {prompt}
      </p>
      <div className="flex flex-row gap-2">
        <button type="button" onClick={onSave} className={buttonClasses("primary", "h-9 text-sm")}>
          Guardar rol
        </button>
        <button
          type="button"
          onClick={onCancel}
          className={buttonClasses("outline", "h-9 text-sm")}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

/** Picked-but-unsaved role of a row and its explicit save (see {@link RoleSelect}). */
function useRoleChange(user: AdminUser) {
  const setRole = useSetRole();
  const selectRef = useRef<HTMLSelectElement>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const pending = setRole.isPending;

  const reset = () => {
    setPicked(null);
    selectRef.current?.focus();
  };

  const save = (role: Role) => {
    if (pending) return;
    // The picked role stays shown until the API answers (rolled back on error by useSetRole).
    setRole.mutate(
      { userId: user.id, role },
      {
        onSettled: () => {
          setPicked(null);
        },
      },
    );
    selectRef.current?.focus();
  };

  return {
    selectRef,
    change: pendingRoleChange(user.role, picked),
    pending,
    setPicked,
    save,
    reset,
  };
}

/**
 * Assigns one of the three roles (persona inscrita, operario, administrador). Changing the select
 * only picks a role (arrow keys can change it): nothing is saved until the admin confirms with
 * «Guardar rol», next to a prompt naming the current and the new role. The select is never
 * disabled (focus stays on it); a save in flight is exposed with `aria-busy`. Not offered for
 * the signed-in admin: the API forbids removing your own admin role.
 */
export function RoleSelect({ user, isCurrentUser }: RoleSelectProps) {
  const { selectRef, change, pending, setPicked, save, reset } = useRoleChange(user);
  const promptId = useId();
  const confirming = change !== null && !pending;

  if (isCurrentUser) {
    return (
      <Text variant="muted" className="text-xs">
        Tu cuenta
      </Text>
    );
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <select
        ref={selectRef}
        aria-label={`Rol de ${user.name}`}
        aria-describedby={confirming ? promptId : undefined}
        aria-busy={pending}
        value={change ?? user.role}
        onChange={(event) => {
          setPicked(event.target.value);
        }}
        className="rounded-md border border-input bg-background px-2 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {ROLE_VALUES.map((role) => (
          <option key={role} value={role}>
            {ROLE_LABELS[role]}
          </option>
        ))}
      </select>
      {confirming ? (
        <RoleChangeConfirm
          id={promptId}
          prompt={roleChangePrompt(user.name, user.role, change)}
          onSave={() => {
            save(change);
          }}
          onCancel={reset}
        />
      ) : null}
    </div>
  );
}
