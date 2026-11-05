import type { AuditEntry } from "@repo/api";
import Link from "next/link";

import {
  INLINE_LINK_CLASSES,
  TABLE_CELL_CLASSES,
  TABLE_HEADER_CLASSES,
} from "../../components/form-styles";
import { DateTime, actorLabel, orderHref } from "../orders";
import { AUDIT_PATH, auditSearch, isAuditEntityOption } from "./audit-filters";
import { AUDIT_ACTION_LABELS, describeAuditChange, entityTypeLabel } from "./audit-format";

const entityFilterHref = ({ entityType, entityId }: AuditEntry): string | null =>
  isAuditEntityOption(entityType)
    ? `${AUDIT_PATH}${auditSearch({ entityType, action: null, entityId })}`
    : null;

function EntityCell({ entry }: Readonly<{ entry: AuditEntry }>) {
  const filterHref = entityFilterHref(entry);
  return (
    <td className={TABLE_CELL_CLASSES}>
      <span className="block font-medium">{entityTypeLabel(entry.entityType)}</span>
      <span className="block break-all font-mono text-xs text-muted-foreground">
        {entry.entityId}
      </span>
      <span className="mt-1 flex flex-row flex-wrap gap-3 text-xs">
        {entry.entityType === "order" ? (
          <Link href={orderHref(entry.entityId)} className={INLINE_LINK_CLASSES}>
            Ver pedido
          </Link>
        ) : null}
        {filterHref === null ? null : (
          <Link href={filterHref} className={INLINE_LINK_CLASSES}>
            Ver registros
          </Link>
        )}
      </span>
    </td>
  );
}

function AuditRow({ entry }: Readonly<{ entry: AuditEntry }>) {
  return (
    <tr className="border-t border-border">
      <td className={`${TABLE_CELL_CLASSES} whitespace-nowrap`}>
        <DateTime value={entry.createdAt} />
      </td>
      <th scope="row" className={`${TABLE_CELL_CLASSES} text-left font-medium`}>
        {AUDIT_ACTION_LABELS[entry.action]}
      </th>
      <EntityCell entry={entry} />
      <td className={TABLE_CELL_CLASSES}>{describeAuditChange(entry)}</td>
      <td className={TABLE_CELL_CLASSES}>{actorLabel(entry.actorRole, entry.actorName)}</td>
    </tr>
  );
}

const COLUMNS = ["Fecha y hora", "Acción", "Entidad", "Cambio", "Responsable"] as const;

/** Audit log rows, newest first (R-AUD-06); dates in Chile's time zone (R-AUD-07). */
export function AuditTable({ entries }: Readonly<{ entries: readonly AuditEntry[] }>) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full border-collapse">
        <caption className="sr-only">
          Registros de auditoría, del más reciente al más antiguo
        </caption>
        <thead>
          <tr>
            {COLUMNS.map((column) => (
              <th key={column} scope="col" className={TABLE_HEADER_CLASSES}>
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <AuditRow key={entry.id} entry={entry} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
