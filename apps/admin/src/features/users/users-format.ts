import { ROLES, type Role } from "@repo/shared";

const ROLE_LABELS: Readonly<Record<Role, string>> = {
  [ROLES.admin]: "Administrador",
  [ROLES.user]: "Usuario",
};

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
  return role === ROLES.admin
    ? `${name} ahora es administrador.`
    : `${name} ya no es administrador.`;
}
