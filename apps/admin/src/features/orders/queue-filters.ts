import type { QueueStatus } from "@repo/api";
import {
  FULFILLMENT_LABELS,
  ORDER_STATUS_LABELS,
  ORDER_STATUSES,
  isFulfillmentType,
  type FulfillmentType,
  type OrderStatus,
} from "@repo/shared";

import {
  readAll,
  readFirst,
  toSearch,
  type SearchPair,
  type SearchParamsRecord,
} from "../../lib/search-params";

/** The queue is the back-office home page. */
export const QUEUE_PATH = "/";

/** Orders per "Cargar más" page of the queue. */
export const QUEUE_PAGE_SIZE = 20;

/** Same limits as the API's `operations.queue` code search (R-OPS-01). */
export const ORDER_CODE_MAX_LENGTH = 20;
const ORDER_CODE_PATTERN = /^[A-Za-z0-9-]*$/;

/** Query parameters of the queue URL (shareable, survives reloads). */
export const QUEUE_PARAMS = { status: "status", fulfillment: "fulfillment", code: "code" } as const;

const isQueueStatus = (status: OrderStatus): status is QueueStatus => status !== "draft";

/** Statuses the queue can filter by, in lifecycle order: every status but `draft` (R-OPS-02). */
export const QUEUE_STATUS_OPTIONS: readonly QueueStatus[] = ORDER_STATUSES.filter(isQueueStatus);

/** Orders that still need a physical action from the pharmacy ("Por gestionar"). */
export const ACTIONABLE_STATUSES: readonly QueueStatus[] = [
  "payment_validated",
  "in_preparation",
  "ready_for_pickup",
  "in_transit",
  "not_delivered",
];

export type QueueFilters = Readonly<{
  /** Empty = every non-draft status. Always in {@link QUEUE_STATUS_OPTIONS} order. */
  status: readonly QueueStatus[];
  fulfillment: FulfillmentType | null;
  /** Normalized (upper-case) valid code or prefix; `""` = no search. */
  code: string;
}>;

export const EMPTY_QUEUE_FILTERS: QueueFilters = { status: [], fulfillment: null, code: "" };

export type ParsedQueueFilters = Readonly<{
  filters: QueueFilters;
  /** What the person typed (for the field), even when invalid. */
  codeInput: string;
  /** Why the code was ignored, or `null`. */
  codeError: string | null;
}>;

/** Validation message for a code search, or `null` when it is valid (blank is valid). */
export function orderCodeError(code: string): string | null {
  if (code.length > ORDER_CODE_MAX_LENGTH) {
    return `El código admite hasta ${String(ORDER_CODE_MAX_LENGTH)} caracteres.`;
  }
  if (!ORDER_CODE_PATTERN.test(code)) {
    return "El código solo puede tener letras, números y guiones (por ejemplo, P-000123).";
  }
  return null;
}

const statusesIn = (values: readonly string[]): QueueStatus[] =>
  QUEUE_STATUS_OPTIONS.filter((status) => values.includes(status));

/**
 * Queue filters from the page URL. Unknown statuses or modalities are ignored (a hand-edited
 * URL never breaks the page); an invalid code is reported and not sent to the API. Pure.
 */
export function parseQueueFilters(params: SearchParamsRecord): ParsedQueueFilters {
  const fulfillment = readFirst(params, QUEUE_PARAMS.fulfillment);
  const codeInput = readFirst(params, QUEUE_PARAMS.code) ?? "";
  const codeError = orderCodeError(codeInput);

  return {
    filters: {
      status: statusesIn(readAll(params, QUEUE_PARAMS.status)),
      fulfillment: isFulfillmentType(fulfillment) ? fulfillment : null,
      code: codeError === null ? codeInput.toUpperCase() : "",
    },
    codeInput,
    codeError,
  };
}

/** Query string of the queue for these filters (`""` without filters). Pure. */
export function queueSearch(filters: QueueFilters): string {
  const pairs: SearchPair[] = statusesIn(filters.status).map((status): SearchPair => [
    QUEUE_PARAMS.status,
    status,
  ]);
  if (filters.fulfillment !== null) pairs.push([QUEUE_PARAMS.fulfillment, filters.fulfillment]);
  if (filters.code !== "") pairs.push([QUEUE_PARAMS.code, filters.code]);
  return toSearch(pairs);
}

/** Input of `operations.queue` (no `undefined` keys, so the query key stays stable). Pure. */
export function toQueueInput(filters: QueueFilters) {
  return {
    limit: QUEUE_PAGE_SIZE,
    ...(filters.status.length === 0 ? {} : { status: [...filters.status] }),
    ...(filters.fulfillment === null ? {} : { fulfillment: filters.fulfillment }),
    ...(filters.code === "" ? {} : { q: filters.code }),
  };
}

export function hasActiveFilters(filters: QueueFilters): boolean {
  return filters.status.length > 0 || filters.fulfillment !== null || filters.code !== "";
}

/** Plain-language summary of the active filters, announced with the results. Pure. */
export function describeQueueFilters(filters: QueueFilters): string {
  const parts: string[] = [];
  if (filters.status.length > 0) {
    parts.push(`estado ${filters.status.map((status) => ORDER_STATUS_LABELS[status]).join(" o ")}`);
  }
  if (filters.fulfillment !== null) {
    parts.push(`modalidad ${FULFILLMENT_LABELS[filters.fulfillment]}`);
  }
  if (filters.code !== "") parts.push(`código que empieza con ${filters.code}`);
  return parts.length === 0 ? "Sin filtros: todos los pedidos." : `Filtros: ${parts.join("; ")}.`;
}

/** Text of the results live region: loading, empty or how many orders are shown. Pure. */
export function queueResultText(
  state: Readonly<{ pending: boolean; count: number; hasMore: boolean; filters: QueueFilters }>,
): string {
  if (state.pending) return "Cargando pedidos…";
  const filtersText = describeQueueFilters(state.filters);
  if (state.count === 0) {
    return hasActiveFilters(state.filters)
      ? `No hay pedidos que cumplan los filtros. ${filtersText}`
      : "Aún no hay pedidos confirmados.";
  }
  const shown =
    state.count === 1 ? "Mostrando 1 pedido" : `Mostrando ${String(state.count)} pedidos`;
  return `${shown}${state.hasMore ? " (hay más)" : ""}. ${filtersText}`;
}
