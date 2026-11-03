import type { QueueItem } from "@repo/api";
import { cn } from "@repo/ui";
import Link from "next/link";

import {
  INLINE_LINK_CLASSES,
  TABLE_CELL_CLASSES,
  TABLE_HEADER_CLASSES,
} from "../../components/form-styles";
import { DateTime } from "./date-time";
import { formatClp, fulfillmentLabel, unitsLabel } from "./orders-format";
import { StatusBadge } from "./status-badge";

/** Detail page of an order. */
export const orderHref = (id: string): string => `/orders/${encodeURIComponent(id)}`;

const COLUMNS = [
  { label: "Código", className: "" },
  { label: "Estado", className: "" },
  { label: "Modalidad", className: "" },
  { label: "Unidades", className: "hidden md:table-cell text-right" },
  { label: "Total", className: "text-right" },
  { label: "Creado", className: "hidden sm:table-cell" },
  { label: "Última actualización", className: "hidden lg:table-cell" },
] as const;

function QueueRow({ order }: Readonly<{ order: QueueItem }>) {
  return (
    <tr className="border-t border-border">
      <th scope="row" className={`${TABLE_CELL_CLASSES} text-left`}>
        {/* The accessible name keeps the visible code (label in name, WCAG 2.5.3). */}
        <Link
          href={orderHref(order.id)}
          aria-label={`Ver pedido ${order.code}`}
          className={INLINE_LINK_CLASSES}
        >
          {order.code}
        </Link>
      </th>
      <td className={TABLE_CELL_CLASSES}>
        <StatusBadge status={order.status} />
      </td>
      <td className={TABLE_CELL_CLASSES}>{fulfillmentLabel(order.fulfillment)}</td>
      <td className={`${TABLE_CELL_CLASSES} hidden text-right md:table-cell`}>
        {unitsLabel(order.itemCount)}
      </td>
      <td className={`${TABLE_CELL_CLASSES} text-right tabular-nums`}>
        {formatClp(order.totalClp)}
      </td>
      <td className={`${TABLE_CELL_CLASSES} hidden sm:table-cell`}>
        <DateTime value={order.createdAt} />
      </td>
      <td className={`${TABLE_CELL_CLASSES} hidden lg:table-cell`}>
        <DateTime value={order.updatedAt} />
      </td>
    </tr>
  );
}

/** Queue table (R-OPS-03): oldest first; secondary columns hide on narrow screens. */
export function QueueTable({ orders }: Readonly<{ orders: readonly QueueItem[] }>) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full border-collapse">
        <caption className="sr-only">
          Pedidos de la bandeja, del más antiguo al más reciente
        </caption>
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
          {orders.map((order) => (
            <QueueRow key={order.id} order={order} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
