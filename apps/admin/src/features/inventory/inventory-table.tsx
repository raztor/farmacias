import type { InventoryItemView } from "@repo/api";
import { cn } from "@repo/ui";
import Link from "next/link";

import {
  INLINE_LINK_CLASSES,
  TABLE_CELL_CLASSES,
  TABLE_HEADER_CLASSES,
} from "../../components/form-styles";
import { productStockHref } from "./inventory-filters";
import { stockUnitsLabel } from "./inventory-format";
import { StockLevelBadge } from "./stock-level-badge";

const COLUMNS = [
  { label: "Producto", className: "" },
  { label: "SKU", className: "hidden md:table-cell" },
  { label: "Stock", className: "text-right" },
  { label: "Umbral", className: "hidden sm:table-cell text-right" },
  { label: "Nivel", className: "" },
] as const;

function InventoryRow({ item }: Readonly<{ item: InventoryItemView }>) {
  return (
    <tr className="border-t border-border">
      <th scope="row" className={`${TABLE_CELL_CLASSES} text-left font-normal`}>
        {/* The accessible name keeps the visible product name (label in name, WCAG 2.5.3). */}
        <Link
          href={productStockHref(item.productId)}
          aria-label={`Ver stock de ${item.name}`}
          className={INLINE_LINK_CLASSES}
        >
          {item.name}
        </Link>
        <span className="block text-muted-foreground">
          {item.presentation}
          {item.active ? "" : " · Inactivo"}
        </span>
      </th>
      <td className={`${TABLE_CELL_CLASSES} hidden md:table-cell`}>{item.sku}</td>
      <td className={`${TABLE_CELL_CLASSES} text-right tabular-nums`}>
        {stockUnitsLabel(item.onHand)}
      </td>
      <td className={`${TABLE_CELL_CLASSES} hidden text-right tabular-nums sm:table-cell`}>
        {item.lowStockThreshold}
      </td>
      <td className={TABLE_CELL_CLASSES}>
        <StockLevelBadge level={item.level} />
      </td>
    </tr>
  );
}

type InventoryTableProps = Readonly<{ items: readonly InventoryItemView[]; caption: string }>;

/** Stock table: name, SKU, units, threshold and level; secondary columns hide on narrow screens. */
export function InventoryTable({ items, caption }: InventoryTableProps) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full border-collapse">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {COLUMNS.map((column) => (
              <th
                key={column.label}
                scope="col"
                className={cn(TABLE_HEADER_CLASSES, column.className)}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <InventoryRow key={item.productId} item={item} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
