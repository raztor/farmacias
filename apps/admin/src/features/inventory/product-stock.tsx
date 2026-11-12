"use client";

import type { InventoryItemView } from "@repo/api";
import { Heading, Text } from "@repo/ui";
import Link from "next/link";

import { INLINE_LINK_CLASSES } from "../../components/form-styles";
import { QueryError } from "../../components/query-error";
import { INVENTORY_PATH } from "./inventory-filters";
import { stockUnitsLabel } from "./inventory-format";
import { MovementHistory } from "./movement-history";
import { StockAdjustForm } from "./stock-adjust-form";
import { StockLevelBadge } from "./stock-level-badge";
import { useProductStock } from "./use-inventory";

function BackLink() {
  return (
    <Link href={INVENTORY_PATH} className={`${INLINE_LINK_CLASSES} self-start text-sm`}>
      ← Volver al inventario
    </Link>
  );
}

function StockSummary({ item }: Readonly<{ item: InventoryItemView }>) {
  const facts = [
    ["Stock actual", stockUnitsLabel(item.onHand)],
    ["Umbral de stock bajo", stockUnitsLabel(item.lowStockThreshold)],
    ["SKU", item.sku],
    ["Catálogo", item.active ? "Activo" : "Inactivo"],
  ] as const;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <div className="flex flex-row flex-wrap items-center gap-3">
          <Heading level={1}>{item.name}</Heading>
          <StockLevelBadge level={item.level} className="text-sm" />
        </div>
        <Text variant="muted">{item.presentation}</Text>
      </div>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-lg border border-border bg-card p-4 md:grid-cols-4">
        {facts.map(([term, value]) => (
          <div key={term} className="flex flex-col">
            <dt className="text-sm text-muted-foreground">{term}</dt>
            <dd className="text-base font-medium text-foreground">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** Stock page of a product (HU-10): summary, receipt/adjustment form and ledger. */
export function ProductStock({ productId }: Readonly<{ productId: string }>) {
  const query = useProductStock(productId);

  if (query.isPending) {
    return (
      <div className="flex flex-col gap-4">
        <BackLink />
        <Text role="status" variant="muted">
          Cargando producto…
        </Text>
      </div>
    );
  }
  if (query.isError) {
    return (
      <div className="flex flex-col gap-4">
        <BackLink />
        <Heading level={1}>Stock del producto</Heading>
        <QueryError
          error={query.error}
          retrying={query.isRefetching}
          onRetry={() => {
            void query.refetch();
          }}
        />
      </div>
    );
  }

  const item = query.data;
  return (
    <div className="flex flex-col gap-8" aria-busy={query.isFetching}>
      <BackLink />
      <StockSummary item={item} />
      <StockAdjustForm item={item} />
      <MovementHistory productId={item.productId} />
    </div>
  );
}
