import { createEnv, type EnvSource } from "@repo/shared";
import { z } from "zod";

/**
 * Knobs of the catalog search performance run (T-10, RNF-04). Defaults are the agreed volume
 * documented in docs/validation/rendimiento-buscador.md; CI runs the defaults as a smoke test.
 *
 * - `CATALOG_PERF_REPLICAS`: catalog multiplier (seed of 200 products × replicas).
 * - `CATALOG_PERF_ROUNDS`: measured rounds over the whole term list.
 * - `CATALOG_PERF_REPORT_FILE`: optional path where the JSON report is written.
 */
export const perfConfigSchema = z.object({
  CATALOG_PERF_REPLICAS: z.coerce.number().int().min(1).max(100).default(10),
  CATALOG_PERF_ROUNDS: z.coerce.number().int().min(1).max(1000).default(20),
  CATALOG_PERF_REPORT_FILE: z.string().trim().min(1).optional(),
});

export type PerfConfig = z.output<typeof perfConfigSchema>;

export const parsePerfConfig = (source: EnvSource): PerfConfig =>
  createEnv(perfConfigSchema, source);

/** RNF-04: 95 % of the searches answer in under 2 seconds. */
export const P95_TARGET_MS = 2000;
