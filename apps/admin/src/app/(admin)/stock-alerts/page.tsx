import { can } from "@repo/shared";
import type { Metadata } from "next";

import { PageHeader, StockAlerts, getAdminAccess } from "../_deps";

export const metadata: Metadata = { title: "Alertas de stock" };

/** Low-stock alerts (HU-12, D-27). `inventory.alerts` enforces the role again (D-31). */
export default async function StockAlertsPage() {
  // Same (cached) check as the `(admin)` layout, which renders the redirect or the 403 page.
  const access = await getAdminAccess();
  if (access.status !== "granted") return null;
  if (!can(access.role, "inventory", "read")) {
    return (
      <PageHeader
        title="Alertas de stock"
        description="Solo operarios y administradores pueden revisar las alertas de stock."
      />
    );
  }

  return (
    <>
      <PageHeader
        title="Alertas de stock"
        description="Productos activos con stock en o bajo su umbral: primero los agotados. Entra a un producto para registrar una recepción o cambiar su umbral."
      />
      <StockAlerts />
    </>
  );
}
