import type { OperationsDelivery } from "@repo/api";

import { DetailSection } from "./detail-section";

/** Synthetic delivery data (D-04), only for delivery orders. */
export function OrderDelivery({ delivery }: Readonly<{ delivery: OperationsDelivery }>) {
  const rows: readonly (readonly [string, string])[] = [
    ["Sector", delivery.sector],
    ["Referencia de dirección", delivery.addressReference],
    ["Contacto", delivery.contactAlias],
    ["Instrucciones", delivery.instructions ?? "Sin instrucciones"],
  ];
  return (
    <DetailSection id="order-delivery-title" title="Datos de despacho (simulado)">
      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-2">
        {rows.map(([term, value]) => (
          <div key={term} className="flex flex-col">
            <dt className="text-sm text-muted-foreground">{term}</dt>
            <dd className="text-base text-foreground">{value}</dd>
          </div>
        ))}
      </dl>
    </DetailSection>
  );
}
