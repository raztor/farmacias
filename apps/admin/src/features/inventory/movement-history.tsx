"use client";

import type { StockMovementView } from "@repo/api";
import { Button, Text } from "@repo/ui";

import { TABLE_CELL_CLASSES, TABLE_HEADER_CLASSES } from "../../components/form-styles";
import { QueryError } from "../../components/query-error";
import { getTrpcErrorMessage } from "../../lib/trpc-errors";
import { DateTime, actorLabel } from "../orders";
import { MOVEMENT_REASON_LABELS, formatDelta } from "./inventory-format";
import { useStockMovements } from "./use-inventory";

const HEADERS = ["Fecha", "Movimiento", "Cantidad", "Stock", "Responsable", "Motivo o nota"];

function MovementRow({ movement }: Readonly<{ movement: StockMovementView }>) {
  const detail = [
    movement.note,
    movement.orderCode === null ? null : `Pedido ${movement.orderCode}`,
  ]
    .filter((part) => part !== null)
    .join(" · ");
  return (
    <tr className="border-t border-border">
      <td className={TABLE_CELL_CLASSES}>
        <DateTime value={movement.createdAt} />
      </td>
      <th scope="row" className={`${TABLE_CELL_CLASSES} text-left font-medium`}>
        {MOVEMENT_REASON_LABELS[movement.reason]}
      </th>
      <td className={`${TABLE_CELL_CLASSES} text-right tabular-nums`}>
        {formatDelta(movement.delta)}
      </td>
      <td className={`${TABLE_CELL_CLASSES} whitespace-nowrap tabular-nums`}>
        {movement.quantityBefore} → {movement.quantityAfter}
      </td>
      <td className={TABLE_CELL_CLASSES}>{actorLabel(movement.actorRole, movement.actorName)}</td>
      <td className={TABLE_CELL_CLASSES}>{detail === "" ? "—" : detail}</td>
    </tr>
  );
}

function MovementTable({ movements }: Readonly<{ movements: readonly StockMovementView[] }>) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full border-collapse">
        <caption className="sr-only">Movimientos de stock, del más reciente al más antiguo</caption>
        <thead>
          <tr>
            {HEADERS.map((header) => (
              <th key={header} scope="col" className={TABLE_HEADER_CLASSES}>
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {movements.map((movement) => (
            <MovementRow key={movement.id} movement={movement} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** A product's stock ledger, newest first, with who made each change and why (R-INV-16). */
export function MovementHistory({ productId }: Readonly<{ productId: string }>) {
  const query = useStockMovements(productId);
  const movements = query.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <section aria-labelledby="stock-history-title" className="flex flex-col gap-3">
      <h2 id="stock-history-title" className="text-lg font-semibold text-foreground">
        Historial de movimientos
      </h2>
      {query.isPending ? (
        <Text role="status" variant="muted">
          Cargando movimientos…
        </Text>
      ) : null}
      {query.isError && !query.isFetchNextPageError ? (
        <QueryError
          error={query.error}
          retrying={query.isRefetching}
          onRetry={() => {
            void query.refetch();
          }}
        />
      ) : null}
      {query.isSuccess && movements.length === 0 ? (
        <Text variant="muted">Este producto aún no tiene movimientos de stock.</Text>
      ) : null}
      {movements.length > 0 ? <MovementTable movements={movements} /> : null}
      {query.isFetchNextPageError ? (
        <Text role="alert" className="text-destructive">
          {getTrpcErrorMessage(query.error)}
        </Text>
      ) : null}
      {query.hasNextPage ? (
        <Button
          variant="outline"
          className="self-center"
          loading={query.isFetchingNextPage}
          onPress={() => {
            void query.fetchNextPage();
          }}
        >
          Cargar más movimientos
        </Button>
      ) : null}
    </section>
  );
}
