import {
  AppError,
  ORDER_STATUS_LABELS,
  ORDER_STATUSES,
  type ActorRole,
  type FulfillmentType,
  type OrderStatus,
} from "@repo/shared";

/**
 * Order state machine (Inception v2.0 §4.6, docs/specs/order-status.md). Pure: no I/O. It is the
 * single source of truth of which transition is valid, for which actor and under which
 * fulfillment; every module that changes an order status asks it first.
 */

/** Who may fire a transition: the order owner (resident), back-office staff or the system. */
type ActorKind = "owner" | "operational" | "system";

type TransitionRule = {
  from: OrderStatus;
  to: OrderStatus;
  actors: readonly ActorKind[];
  /** Only valid for orders with this fulfillment (R-OST-05). */
  fulfillment?: FulfillmentType;
};

const OWNER_OR_STAFF = ["owner", "operational"] as const satisfies readonly ActorKind[];

/** Transitions T1..T17 of docs/specs/order-status.md §4. Anything else is invalid. */
export const ORDER_TRANSITIONS = [
  { from: "draft", to: "pending_payment", actors: ["owner"] },
  { from: "pending_payment", to: "payment_validated", actors: ["system"] },
  { from: "pending_payment", to: "payment_rejected", actors: ["system"] },
  { from: "payment_rejected", to: "payment_validated", actors: ["system"] },
  { from: "payment_rejected", to: "payment_rejected", actors: ["system"] },
  { from: "payment_validated", to: "in_preparation", actors: ["operational"] },
  {
    from: "in_preparation",
    to: "ready_for_pickup",
    actors: ["operational"],
    fulfillment: "pickup",
  },
  { from: "in_preparation", to: "in_transit", actors: ["operational"], fulfillment: "delivery" },
  { from: "ready_for_pickup", to: "delivered", actors: ["operational"] },
  { from: "in_transit", to: "delivered", actors: ["operational"] },
  { from: "in_transit", to: "not_delivered", actors: ["operational"] },
  { from: "not_delivered", to: "in_transit", actors: ["operational"] },
  { from: "not_delivered", to: "cancelled", actors: ["operational"] },
  { from: "draft", to: "cancelled", actors: OWNER_OR_STAFF },
  { from: "pending_payment", to: "cancelled", actors: OWNER_OR_STAFF },
  { from: "payment_rejected", to: "cancelled", actors: OWNER_OR_STAFF },
  { from: "payment_validated", to: "cancelled", actors: OWNER_OR_STAFF },
] as const satisfies readonly TransitionRule[];

/** Statuses an owner can pay from (`payments.pay`). */
export const PAYABLE_STATUSES = [
  "pending_payment",
  "payment_rejected",
] as const satisfies readonly OrderStatus[];

/** Statuses reached only after an approved payment (stock already discounted once). */
export const PAID_STATUSES = [
  "payment_validated",
  "in_preparation",
  "ready_for_pickup",
  "in_transit",
  "delivered",
  "not_delivered",
] as const satisfies readonly OrderStatus[];

/** Statuses without outgoing transitions. */
export const TERMINAL_STATUSES = [
  "delivered",
  "cancelled",
] as const satisfies readonly OrderStatus[];

export type TransitionQuery = {
  from: OrderStatus;
  to: OrderStatus;
  actorRole: ActorRole;
  /** The actor is the order's resident. Only meaningful for `resident`. */
  isOwner: boolean;
  /** Fulfillment of the order (`null` while it is a draft). */
  fulfillment: FulfillmentType | null;
};

const actorKindOf = (actorRole: ActorRole, isOwner: boolean): ActorKind | null => {
  if (actorRole === "system") return "system";
  if (actorRole === "operator" || actorRole === "admin") return "operational";
  return isOwner ? "owner" : null;
};

const ruleAllows = (rule: TransitionRule, query: TransitionQuery): boolean => {
  const kind = actorKindOf(query.actorRole, query.isOwner);
  if (kind === null || rule.from !== query.from || rule.to !== query.to) return false;
  if (!rule.actors.includes(kind)) return false;
  return rule.fulfillment === undefined || rule.fulfillment === query.fulfillment;
};

/** `true` when the transition is valid for this actor and fulfillment (R-OST-02). */
export const canTransition = (query: TransitionQuery): boolean =>
  ORDER_TRANSITIONS.some((rule) => ruleAllows(rule, query));

/** Spanish label of a status (R-OST-01). */
export const statusLabel = (status: OrderStatus): string => ORDER_STATUS_LABELS[status];

/** CONFLICT `INVALID_TRANSITION`: the order keeps its previous status (R-OST-03). */
export const invalidTransitionError = (from: OrderStatus, to: OrderStatus): AppError =>
  new AppError(
    "CONFLICT",
    `No es posible cambiar el pedido de «${statusLabel(from)}» a «${statusLabel(to)}». ` +
      "El pedido conserva su estado actual.",
    { details: { reason: "INVALID_TRANSITION", from, to } },
  );

/** CONFLICT `STALE_VERSION`: someone changed the order first (R-OST-06). */
export const staleVersionError = (): AppError =>
  new AppError(
    "CONFLICT",
    "Este pedido cambió mientras lo revisabas. Recarga para ver su estado actual.",
    { details: { reason: "STALE_VERSION" } },
  );

/** Throws CONFLICT `INVALID_TRANSITION` unless {@link canTransition} allows it. */
export const assertTransition = (query: TransitionQuery): void => {
  if (!canTransition(query)) throw invalidTransitionError(query.from, query.to);
};

export type AllowedTransitionsQuery = Omit<TransitionQuery, "from" | "to"> & {
  status: OrderStatus;
};

/** Destinations this actor may choose from `status`, in ORDER_STATUSES order (R-OST-10). */
export const allowedTransitions = ({ status, ...actor }: AllowedTransitionsQuery): OrderStatus[] =>
  ORDER_STATUSES.filter((to) => canTransition({ ...actor, from: status, to }));

/** Stock side effect tied to a transition (R-OST-08). */
export type StockEffect = "discount" | "restore" | "none";

/**
 * `discount`: entering `payment_validated` (done once by payments, inside its transaction).
 * `restore`: cancelling a paid order before preparation. `not_delivered → cancelled` never
 * restores automatically (manual adjustment, HU-10 Should).
 */
export const stockEffectOf = (from: OrderStatus, to: OrderStatus): StockEffect => {
  if (to === "payment_validated") return "discount";
  if (from === "payment_validated" && to === "cancelled") return "restore";
  return "none";
};

const PAID_SET: ReadonlySet<OrderStatus> = new Set(PAID_STATUSES);
const PAYABLE_SET: ReadonlySet<OrderStatus> = new Set(PAYABLE_STATUSES);

/** `true` once the order went through an approved payment (and was not cancelled). */
export const isPaidStatus = (status: OrderStatus): boolean => PAID_SET.has(status);

/** `true` when the owner can run a (new) simulated payment. */
export const isPayableStatus = (status: OrderStatus): boolean => PAYABLE_SET.has(status);
