import type { OperationsHistoryEntry } from "@repo/api";

import { DateTime } from "./date-time";
import { DetailSection } from "./detail-section";
import { actorLabel, statusLabel } from "./orders-format";
import { StatusBadge } from "./status-badge";

function HistoryItem({ entry }: Readonly<{ entry: OperationsHistoryEntry }>) {
  return (
    <li className="relative flex flex-col gap-1 border-l-2 border-border pb-4 pl-4 last:pb-0">
      <div className="flex flex-row flex-wrap items-center gap-2">
        <StatusBadge status={entry.toStatus} />
        {entry.fromStatus === null ? (
          <span className="text-sm text-muted-foreground">Pedido creado</span>
        ) : (
          <span className="text-sm text-muted-foreground">
            desde «{statusLabel(entry.fromStatus)}»
          </span>
        )}
      </div>
      <p className="text-sm text-foreground">
        <DateTime value={entry.createdAt} /> · {actorLabel(entry.actorRole, entry.actorName)}
      </p>
      {entry.note === null ? null : (
        <p className="text-sm text-foreground">
          <span className="font-medium">Nota:</span> {entry.note}
        </p>
      )}
    </li>
  );
}

/** Status history, oldest first, with date, time and who made each change (RF-12, HU-08). */
export function OrderHistory({
  history,
}: Readonly<{ history: readonly OperationsHistoryEntry[] }>) {
  return (
    <DetailSection id="order-history-title" title="Historial de estados">
      {history.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin cambios registrados.</p>
      ) : (
        <ol className="flex flex-col">
          {history.map((entry, index) => (
            // Append-only list: the position identifies each event.
            <HistoryItem key={`${String(index)}-${entry.toStatus}`} entry={entry} />
          ))}
        </ol>
      )}
    </DetailSection>
  );
}
