import { ROLE_LABELS, type Role } from "@repo/shared";

const dateFormatter = new Intl.DateTimeFormat("es-CL", { dateStyle: "medium" });

/** Spanish label of a role. */
export function roleLabel(role: Role): string {
  return ROLE_LABELS[role];
}

/** Sign-up date as shown in the users table (Chilean format, viewer's time zone). */
export function formatUserDate(date: Date): string {
  return dateFormatter.format(date);
}

/** Toast shown after a successful role change. */
export function roleChangeMessage(name: string, role: Role): string {
  return `El rol de ${name} ahora es «${ROLE_LABELS[role]}».`;
}
