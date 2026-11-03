/** Response of `health.ping`. */
export type HealthStatus = {
  status: "ok";
  /** Server time (ISO 8601), handy to spot clock skew on clients. */
  time: string;
};
