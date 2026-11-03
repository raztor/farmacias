import type { HealthStatus } from "./health.schema";

export type HealthServiceDeps = {
  /** Clock, injectable for tests. */
  now?: () => Date;
};

export type HealthService = {
  ping: () => HealthStatus;
};

/** Liveness of the API layer itself. Infrastructure checks live in the host's `/ready`. */
export const createHealthService = ({
  now = () => new Date(),
}: HealthServiceDeps = {}): HealthService => ({
  ping: () => ({ status: "ok", time: now().toISOString() }),
});
