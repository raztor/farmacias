"use client";

import { Text } from "@repo/ui";
import Link from "next/link";

import { INLINE_LINK_CLASSES } from "../../components/form-styles";
import { QueryError } from "../../components/query-error";
import { InventoryTable } from "./inventory-table";
import { alertsCountText } from "./threshold-form";
import { useStockAlerts } from "./use-inventory";

/** Back-office alerts page. */
export const STOCK_ALERTS_PATH = "/stock-alerts";

/** Count pill of the alerts (text, never color only). */
function AlertsBadge({ total }: Readonly<{ total: number }>) {
  return (
    <span className="inline-flex min-w-6 items-center justify-center rounded-full border border-warning bg-warning px-2 text-xs font-semibold text-warning-foreground">
      {total}
    </span>
  );
}

/** Link to the alerts with their count, shown on the inventory page (HU-12). */
export function StockAlertsLink() {
  const query = useStockAlerts();
  const total = query.data?.total;
  return (
    <Link
      href={STOCK_ALERTS_PATH}
      className={`${INLINE_LINK_CLASSES} inline-flex items-center gap-2 self-start text-sm`}
    >
      Ver alertas de stock bajo
      {total === undefined ? null : (
        <>
          <AlertsBadge total={total} />
          <span className="sr-only">{alertsCountText(total)}</span>
        </>
      )}
    </Link>
  );
}

/**
 * Low-stock alerts (HU-12, D-27): active products at or under their threshold, out of stock
 * first, then by units. Each row opens the product's stock page to register a receipt.
 */
export function StockAlerts() {
  const query = useStockAlerts();

  if (query.isError) {
    return (
      <QueryError
        error={query.error}
        retrying={query.isRefetching}
        onRetry={() => {
          void query.refetch();
        }}
      />
    );
  }
  const total = query.data?.total ?? 0;
  const items = query.data?.items ?? [];
  return (
    <section aria-labelledby="stock-alerts-title" className="flex flex-col gap-4">
      <h2
        id="stock-alerts-title"
        className="flex flex-row items-center gap-2 text-lg font-semibold"
      >
        Productos con stock bajo {query.isSuccess ? <AlertsBadge total={total} /> : null}
      </h2>
      <Text role="status" variant="muted" aria-live="polite">
        {query.isPending ? "Cargando alertas…" : alertsCountText(total)}
        {items.length < total ? ` Se muestran los primeros ${String(items.length)}.` : ""}
      </Text>
      {items.length > 0 ? (
        <InventoryTable
          items={items}
          caption="Productos con stock bajo: agotados primero, luego por unidades"
        />
      ) : null}
    </section>
  );
}
