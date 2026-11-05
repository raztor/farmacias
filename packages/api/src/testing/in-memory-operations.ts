import type {
  HistoryRecord,
  OperationsRepository,
  OrderDetailRecord,
  QueueQuery,
  QueueRecord,
} from "../modules/operations/operations.repository";
import type { InMemoryOrdering, MemOrder } from "./in-memory-ordering";

/**
 * In-memory double of the operations read side over {@link InMemoryOrdering}, so service tests
 * see the writes of the real transition code. Orders are created one minute apart in insertion
 * order (FIFO), unless `createdAt` overrides it. Kept free of `vitest` imports.
 */

const BASE_TIME = Date.parse("2026-11-01T12:00:00.000Z");
const MINUTE = 60_000;

const matches = (query: QueueQuery) => (order: MemOrder) =>
  query.statuses.some((status) => status === order.status) &&
  (query.fulfillment === undefined || order.fulfillment === query.fulfillment) &&
  (query.q === undefined || order.code.startsWith(query.q));

const compareIds = (a: string, b: string): number => {
  if (a === b) return 0;
  return a < b ? -1 : 1;
};

const fifo = (a: QueueRecord, b: QueueRecord): number =>
  a.createdAt.getTime() - b.createdAt.getTime() || compareIds(a.id, b.id);

/**
 * Same keyset as PostgreSQL: rows strictly after the cursor order in FIFO order, whose position
 * ignores the filters; an unknown cursor yields nothing (never a restart from the first row).
 */
const queuePage = (
  orders: readonly MemOrder[],
  query: QueueQuery,
  toRecord: (order: MemOrder) => QueueRecord,
): QueueRecord[] => {
  const cursorOrder = orders.find((order) => order.id === query.cursor);
  if (query.cursor && !cursorOrder) return [];
  const at = cursorOrder ? toRecord(cursorOrder) : undefined;
  return orders
    .filter(matches(query))
    .map(toRecord)
    .filter((row) => !at || fifo(row, at) > 0)
    .sort(fifo)
    .slice(0, query.take);
};

export type InMemoryOperationsOptions = {
  /** Display names of actors by user id (history). */
  names?: Record<string, string>;
  /** Creation time by order id. */
  createdAt?: Record<string, Date>;
};

export type InMemoryOperationsRepository = OperationsRepository & {
  /** Every query the service sent, in order. */
  queries: QueueQuery[];
};

export const createInMemoryOperationsRepository = (
  mem: InMemoryOrdering,
  options: InMemoryOperationsOptions = {},
): InMemoryOperationsRepository => {
  const queries: QueueQuery[] = [];

  const createdAtOf = (order: MemOrder): Date =>
    options.createdAt?.[order.id] ??
    new Date(BASE_TIME + mem.state.orders.findIndex((other) => other.id === order.id) * MINUTE);

  const toQueueRecord = (order: MemOrder): QueueRecord => ({
    id: order.id,
    code: order.code,
    status: order.status,
    fulfillment: order.fulfillment,
    itemCount: mem.linesOf(order.id).reduce((count, line) => count + line.quantity, 0),
    totalClp: order.totalClp,
    createdAt: createdAtOf(order),
    updatedAt: order.updatedAt,
  });

  const historyOf = (orderId: string): HistoryRecord[] =>
    mem.state.events
      .filter((event) => event.orderId === orderId)
      .map((event) => {
        const actorId = "actorId" in event ? event.actorId : null;
        return {
          fromStatus: event.from,
          toStatus: event.to,
          actorRole: "actorRole" in event ? event.actorRole : "resident",
          actorName: actorId === null ? null : (options.names?.[actorId] ?? null),
          note: "note" in event ? event.note : null,
          createdAt: new Date(BASE_TIME),
        };
      });

  const toDetail = (order: MemOrder): OrderDetailRecord => ({
    ...toQueueRecord(order),
    version: order.version,
    delivery: order.fulfillment === "delivery" ? order.delivery : null,
    lines: mem.linesOf(order.id).map((line) => {
      const product = mem.product(line.productId);
      return {
        ...line,
        commercialName: product.commercialName,
        presentation: product.presentation,
      };
    }),
    history: historyOf(order.id),
  });

  return {
    queries,
    queue: (query) => {
      queries.push(query);
      return Promise.resolve(queuePage(mem.state.orders, query, toQueueRecord));
    },
    findOrder: (id) => {
      const order = mem.state.orders.find((candidate) => candidate.id === id);
      return Promise.resolve(order ? toDetail(order) : null);
    },
  };
};
