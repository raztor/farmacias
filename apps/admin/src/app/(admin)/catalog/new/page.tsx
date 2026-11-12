import { can } from "@repo/shared";
import type { Metadata } from "next";

import { NewProduct, PageHeader, getAdminAccess } from "../../_deps";

export const metadata: Metadata = { title: "Nuevo producto" };

/** Create a product (HU-11, admin only). `catalog.create` enforces the role again. */
export default async function NewProductPage() {
  // Same (cached) check as the `(admin)` layout, which renders the redirect or the 403 page.
  const access = await getAdminAccess();
  if (access.status !== "granted") return null;
  if (!can(access.role, "catalog", "write")) {
    return (
      <PageHeader
        title="Nuevo producto"
        description="Solo los administradores del programa pueden mantener el catálogo y sus precios."
      />
    );
  }

  return (
    <>
      <PageHeader
        title="Nuevo producto"
        description="Completa los datos del medicamento y su precio en pesos chilenos."
      />
      <NewProduct />
    </>
  );
}
