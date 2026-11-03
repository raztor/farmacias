import { ROLE_VALUES } from "../roles";
import { createOneOfGuard } from "./one-of";

/**
 * Who performed a change, as recorded in `order_status_events.actor_role` and
 * `audit_logs.actor_role` (CHECK constraints): a user role, or `system` for automatic
 * changes such as a payment result.
 */
export const ACTOR_ROLES = [...ROLE_VALUES, "system"] as const;

export type ActorRole = (typeof ACTOR_ROLES)[number];

export const isActorRole = createOneOfGuard(ACTOR_ROLES);
