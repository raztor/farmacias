import { can } from "@repo/shared";
import type { Metadata } from "next";

import { EditProduct, PageHeader, getAdminAccess } from "../../_deps";

export const metadata: Metadata = { title: "Editar producto" };

type EditProductPageProps = Readonly<{ params: Promise<{ id: string }> }>;

/** Edit a product (HU-11, admin only). `catalog.adminById` / `catalog.update` enforce the role. */
export default async function EditProductPage({ params }: EditProductPageProps) {
  // Same (cached) check as the `(admin)` layout, which renders the redirect or the 403 page.
  const access = await getAdminAccess();
  if (access.status !== "granted") return null;
  if (!can(access.role, "catalog", "write")) {
    return (
      <PageHeader
        title="Editar producto"
        description="Solo los administradores del programa pueden mantener el catálogo y sus precios."
      />
    );
  }
  const { id } = await params;

  return <EditProduct productId={id} />;
}
