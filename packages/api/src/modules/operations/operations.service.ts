import { AppError, isOperational, noopLogger, type AppLogger, type Role } from "@repo/shared";

import { FORBIDDEN_MESSAGE, type ApiDependencies } from "../../trpc";
import { allowedTransitions, staleVersionError, statusLabel } from "../order-status";
import {
  applyTransition,
  createTransitionRunner,
  orderNotFoundError,
  type TransitionRunner,
} from "../orders";
import {
  createOperationsRepository,
  type OperationsRepository,
  type OrderDetailRecord,
  type QueueRecord,
} from "./operations.repository";
import {
  isOperatorTarget,
  isQueueStatus,
  QUEUE_STATUSES,
  type OperationsOrderDetail,
  type OperatorTarget,
  type QueueInput,
  type QueueItem,
  type QueueResult,
  type TransitionInput,
} from "./operations.schema";

/** The signed-in back-office user (operator or admin); the id always comes from the session. */
export type OperationsActor = { id: string; role: Role };

export type OperationsService = {
  /** HU-07 #1: non-draft orders matching every filter, oldest first, cursor paginated. */
  queue: (actor: OperationsActor, input: QueueInput) => Promise<QueueResult>;
  /** R-OPS-05: lines, delivery data, history and the transitions the caller may register. */
  order: (actor: OperationsActor, id: string) => Promise<OperationsOrderDetail>;
  /** HU-08: registers one physical transition (compare-and-set on `expectedVersion`). */
  transition: (actor: OperationsActor, input: TransitionInput) => Promise<OperationsOrderDetail>;
};

export type OperationsServiceDeps = {
  repo: OperationsRepository;
  runner: TransitionRunner;
  logger?: AppLogger;
};

/**
 * Defense in depth: `operatorProcedure` already rejects other roles (HU-07 #2), but the service
 * never trusts its caller to have checked.
 */
const assertOperational = (actor: OperationsActor): void => {
  if (!isOperational(actor.role)) {
    throw new AppError("FORBIDDEN", FORBIDDEN_MESSAGE);
  }
};

/** Destinations this actor may register from the order's status (state machine, R-OPS-05). */
export const allowedTargetsFor = (
  order: Pick<OrderDetailRecord, "status" | "fulfillment">,
  role: Role,
): OperatorTarget[] =>
  allowedTransitions({
    status: order.status,
    actorRole: role,
    isOwner: false,
    fulfillment: order.fulfillment,
  }).filter(isOperatorTarget);

export const toQueueItem = (record: QueueRecord): QueueItem => ({
  id: record.id,
  code: record.code,
  status: record.status,
  statusLabel: statusLabel(record.status),
  fulfillment: record.fulfillment,
  itemCount: record.itemCount,
  totalClp: record.totalClp,
  createdAt: record.createdAt,
  updatedAt: record.updatedAt,
});

export const toOrderDetail = (record: OrderDetailRecord, role: Role): OperationsOrderDetail => ({
  ...toQueueItem(record),
  version: record.version,
  lines: record.lines,
  delivery: record.delivery,
  history: record.history.map((event) => ({ ...event, toLabel: statusLabel(event.toStatus) })),
  allowedTransitions: allowedTargetsFor(record, role),
});

export const createOperationsService = ({
  repo,
  runner,
  logger = noopLogger,
}: OperationsServiceDeps): OperationsService => {
  const order: OperationsService["order"] = async (actor, id) => {
    assertOperational(actor);
    const record = await repo.findOrder(id);
    // Drafts are the resident's private cart: invisible to the back office (R-OPS-02).
    if (!record || !isQueueStatus(record.status)) throw orderNotFoundError();
    return toOrderDetail(record, actor.role);
  };

  return {
    queue: async (actor, { limit, status, ...filters }) => {
      assertOperational(actor);
      const rows = await repo.queue({
        ...filters,
        statuses: status ?? QUEUE_STATUSES,
        take: limit + 1,
      });
      const hasMore = rows.length > limit;
      const items = (hasMore ? rows.slice(0, limit) : rows).map(toQueueItem);
      return { items, nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null };
    },

    order,

    // One transaction: lock the order, check the version the operator saw, then the state machine
    // validates the move and writes status event + audit (+ stock restore when it applies).
    transition: async (actor, input) => {
      assertOperational(actor);
      const from = await runner.transaction(async (deps) => {
        const current = await deps.transitions.lockOrder(input.id);
        if (!current || !isQueueStatus(current.status)) throw orderNotFoundError();
        // Stale first: whoever lost a race must reload, whatever the move was (R-OPS-09).
        if (current.version !== input.expectedVersion) throw staleVersionError();
        await applyTransition(deps, {
          order: current,
          to: input.to,
          actor: { id: actor.id, role: actor.role },
          expectedVersion: input.expectedVersion,
          note: input.note,
        });
        return current.status;
      });
      logger.info(
        { orderId: input.id, from, to: input.to, actorRole: actor.role },
        "Order transition registered by operations",
      );
      return order(actor, input.id);
    },
  };
};

/** Wires the service to Prisma and the request logger. */
export const createOperationsServiceFromDeps = (
  deps: Pick<ApiDependencies, "db">,
  logger: AppLogger,
): OperationsService =>
  createOperationsService({
    repo: createOperationsRepository(deps.db),
    runner: createTransitionRunner(deps.db),
    logger,
  });
