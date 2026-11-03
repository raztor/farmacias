import type { Metadata } from "next";

import { PageHeader, UsersPanel, getAdminAccess } from "../_deps";

export const metadata: Metadata = { title: "Usuarios" };

export default async function UsersPage() {
  // Same (cached) check as the `(admin)` layout, which renders the redirect or the 403 page.
  const access = await getAdminAccess();
  if (access.status !== "granted") return null;

  return (
    <>
      <PageHeader
        title="Usuarios"
        description="Busca cuentas y gestiona quién tiene acceso de administrador."
      />
      <UsersPanel currentUserId={access.session.user.id} />
    </>
  );
}
