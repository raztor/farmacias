"use client";

import { UserRow } from "./user-row";
import type { AdminUser } from "./users-cache";

type UsersTableProps = Readonly<{ users: readonly AdminUser[]; currentUserId: string }>;

const HEADER_CLASSES = "px-4 py-3 text-left text-sm font-medium text-muted-foreground";

/**
 * Responsive table: status and creation date are hidden on narrow screens. The wrapper is
 * `relative` so the absolutely positioned `sr-only` header stays inside its scroll box instead
 * of widening the page (T-09: 12 px of horizontal scroll at 200 % zoom, WCAG 1.4.10).
 */
export function UsersTable({ users, currentUserId }: UsersTableProps) {
  return (
    <div className="relative overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full border-collapse">
        <caption className="sr-only">Usuarios registrados</caption>
        <thead>
          <tr>
            <th scope="col" className={HEADER_CLASSES}>
              Usuario
            </th>
            <th scope="col" className={HEADER_CLASSES}>
              Rol
            </th>
            <th scope="col" className={`hidden md:table-cell ${HEADER_CLASSES}`}>
              Estado
            </th>
            <th scope="col" className={`hidden sm:table-cell ${HEADER_CLASSES}`}>
              Registro
            </th>
            <th scope="col" className={`${HEADER_CLASSES} text-right`}>
              <span className="sr-only">Acciones</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <UserRow key={user.id} user={user} isCurrentUser={user.id === currentUserId} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
