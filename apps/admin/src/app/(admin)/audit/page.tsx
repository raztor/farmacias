import { isAdmin } from "@repo/shared";
import type { Metadata } from "next";

import {
  AuditFiltersForm,
  AuditList,
  PageHeader,
  getAdminAccess,
  parseAuditFilters,
  type SearchParamsRecord,
} from "../_deps";

export const metadata: Metadata = { title: "Auditoría" };

type AuditPageProps = Readonly<{ searchParams: Promise<SearchParamsRecord> }>;

/** Audit review (admin only, R-AUD-06): critical changes with actor, date and values. */
export default async function AuditPage({ searchParams }: AuditPageProps) {
  // Same (cached) check as the `(admin)` layout, which renders the redirect or the 403 page.
  const access = await getAdminAccess();
  if (access.status !== "granted") return null;
  if (!isAdmin(access.role)) {
    // Operators: the API also answers FORBIDDEN to `audit.list`.
    return (
      <PageHeader
        title="Auditoría"
        description="Solo los administradores del programa pueden revisar la auditoría."
      />
    );
  }
  const parsed = parseAuditFilters(await searchParams);

  return (
    <>
      <PageHeader
        title="Auditoría"
        description="Cambios de estado, stock y roles con fecha, hora (de Chile) y responsable."
      />
      <AuditFiltersForm
        key={`${parsed.filters.entityType ?? ""}|${parsed.filters.action ?? ""}|${parsed.entityIdInput}`}
        parsed={parsed}
      />
      <AuditList filters={parsed.filters} />
    </>
  );
}
