import { ROLE_LABELS, isRole, type Role } from "@repo/shared";

import { DISPLAY_TIME_ZONE } from "../../lib/display-time-zone";

const dateFormatter = new Intl.DateTimeFormat("es-CL", {
  dateStyle: "medium",
  timeZone: DISPLAY_TIME_ZONE,
});

/** Spanish label of a role. */
export function roleLabel(role: Role): string {
  return ROLE_LABELS[role];
}

/** Sign-up date as shown in the users table (Chilean format and calendar day, D-23). */
export function formatUserDate(date: Date): string {
  return dateFormatter.format(date);
}

/** Toast shown after a successful role change. */
export function roleChangeMessage(name: string, role: Role): string {
  return `El rol de ${name} ahora es «${ROLE_LABELS[role]}».`;
}

/**
 * Role picked in the select that differs from the saved one, or `null` when there is nothing to
 * save. Changing the select never saves by itself: the admin confirms with «Guardar rol». Pure.
 */
export function pendingRoleChange(saved: Role, picked: string | null): Role | null {
  return picked !== null && isRole(picked) && picked !== saved ? picked : null;
}

/** Confirmation shown next to «Guardar rol», naming the current and the new role. */
export function roleChangePrompt(name: string, from: Role, to: Role): string {
  return `¿Cambiar el rol de ${name} de «${ROLE_LABELS[from]}» a «${ROLE_LABELS[to]}»?`;
}
