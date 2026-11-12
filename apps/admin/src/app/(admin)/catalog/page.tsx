import { can } from "@repo/shared";
import type { Metadata } from "next";

import { ButtonLink, NEW_PRODUCT_PATH, PageHeader, ProductsPanel, getAdminAccess } from "../_deps";

export const metadata: Metadata = { title: "Catálogo" };

/** Catalog maintenance (HU-11, admin only, D-28): products, prices and active / inactive. */
export default async function CatalogPage() {
  // Same (cached) check as the `(admin)` layout, which renders the redirect or the 403 page.
  const access = await getAdminAccess();
  if (access.status !== "granted") return null;
  if (!can(access.role, "catalog", "write")) {
    // Operators: the API also answers FORBIDDEN to every `catalog.admin*` / write procedure.
    return (
      <PageHeader
        title="Catálogo"
        description="Solo los administradores del programa pueden mantener el catálogo y sus precios."
      />
    );
  }

  return (
    <>
      <div className="flex flex-row flex-wrap items-end justify-between gap-4">
        <PageHeader
          title="Catálogo"
          description="Crea y edita productos, precios y su estado. Los productos no se borran: se desactivan."
        />
        <ButtonLink href={NEW_PRODUCT_PATH}>Nuevo producto</ButtonLink>
      </div>
      <ProductsPanel />
    </>
  );
}
