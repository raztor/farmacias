import { isAdmin } from "@repo/shared";
import type { Metadata } from "next";

import { PageHeader, StatsOverview, UsersPanel, getAdminAccess } from "../_deps";

export const metadata: Metadata = { title: "Usuarios" };

export default async function UsersPage() {
  // Same (cached) check as the `(admin)` layout, which renders the redirect or the 403 page.
  const access = await getAdminAccess();
  if (access.status !== "granted") return null;
  if (!isAdmin(access.role)) {
    // Operators: the API also answers FORBIDDEN to every `admin.*` procedure.
    return (
      <PageHeader
        title="Usuarios"
        description="Solo los administradores del programa pueden gestionar cuentas y roles."
      />
    );
  }

  return (
    <>
      <PageHeader
        title="Usuarios"
        description="Busca cuentas y asigna su rol: persona inscrita, operario o administrador."
      />
      <StatsOverview />
      <UsersPanel currentUserId={access.session.user.id} />
    </>
  );
}
