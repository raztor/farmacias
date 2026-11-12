import { can } from "@repo/shared";
import type { Metadata } from "next";

import { PageHeader, ProductStock, getAdminAccess } from "../../_deps";

export const metadata: Metadata = { title: "Stock del producto" };

type ProductStockPageProps = Readonly<{ params: Promise<{ id: string }> }>;

/** Stock page of a product (HU-10): receipts, adjustments and ledger. */
export default async function ProductStockPage({ params }: ProductStockPageProps) {
  // Same (cached) check as the `(admin)` layout, which renders the redirect or the 403 page.
  const access = await getAdminAccess();
  if (access.status !== "granted") return null;
  if (!can(access.role, "inventory", "adjust")) {
    return (
      <PageHeader
        title="Stock del producto"
        description="Solo operarios y administradores pueden registrar movimientos de stock."
      />
    );
  }
  const { id } = await params;

  return <ProductStock productId={id} />;
}
