import { can } from "@repo/shared";
import type { Metadata } from "next";

import {
  InventoryFiltersForm,
  InventoryList,
  PageHeader,
  getAdminAccess,
  inventorySearch,
  parseInventoryFilters,
  type SearchParamsRecord,
} from "../_deps";

export const metadata: Metadata = { title: "Inventario" };

type InventoryPageProps = Readonly<{ searchParams: Promise<SearchParamsRecord> }>;

/** Back-office stock list (HU-10, HU-12). `inventory.*` enforces the role again (D-31). */
export default async function InventoryPage({ searchParams }: InventoryPageProps) {
  // Same (cached) check as the `(admin)` layout, which renders the redirect or the 403 page.
  const access = await getAdminAccess();
  if (access.status !== "granted") return null;
  if (!can(access.role, "inventory", "read")) {
    return (
      <PageHeader
        title="Inventario"
        description="Solo operarios y administradores pueden revisar el inventario."
      />
    );
  }
  const parsed = parseInventoryFilters(await searchParams);

  return (
    <>
      <PageHeader
        title="Inventario"
        description="Stock de cada producto. Entra a un producto para registrar recepciones o ajustes con su motivo."
      />
      {/* Keyed by the URL so the form shows the applied filters after each navigation. */}
      <InventoryFiltersForm
        key={`${inventorySearch(parsed.filters)}|${parsed.searchInput}`}
        parsed={parsed}
      />
      <InventoryList filters={parsed.filters} />
    </>
  );
}
