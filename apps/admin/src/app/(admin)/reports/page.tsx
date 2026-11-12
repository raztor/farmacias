import { can } from "@repo/shared";
import type { Metadata } from "next";

import {
  PageHeader,
  ReportsFiltersForm,
  ReportsOverview,
  getAdminAccess,
  parseReportsFilters,
  type SearchParamsRecord,
} from "../_deps";

export const metadata: Metadata = { title: "Reportes" };

type ReportsPageProps = Readonly<{ searchParams: Promise<SearchParamsRecord> }>;

/** Operational reports (HU-13, admin only, D-29): units dispensed, orders by status, low stock. */
export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  // Same (cached) check as the `(admin)` layout, which renders the redirect or the 403 page.
  const access = await getAdminAccess();
  if (access.status !== "granted") return null;
  if (!can(access.role, "reports", "read")) {
    // Operators: the API also answers FORBIDDEN to `reports.summary`.
    return (
      <PageHeader
        title="Reportes"
        description="Solo los administradores del programa pueden consultar los reportes."
      />
    );
  }
  const parsed = parseReportsFilters(await searchParams);

  return (
    <>
      <PageHeader
        title="Reportes"
        description="Unidades dispensadas, pedidos por estado y productos bajo umbral, con datos agregados."
      />
      <ReportsFiltersForm key={`${parsed.input.from}|${parsed.input.to}`} parsed={parsed} />
      <ReportsOverview filters={parsed.filters} />
    </>
  );
}
