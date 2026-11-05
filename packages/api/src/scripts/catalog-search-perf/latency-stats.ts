/** Latency summary in milliseconds (rounded to 0.01 ms). */
export type LatencyStats = {
  count: number;
  min: number;
  mean: number;
  p50: number;
  p95: number;
  p99: number;
  max: number;
};

const round = (value: number): number => Math.round(value * 100) / 100;

/**
 * Nearest-rank percentile (no interpolation): the smallest sample such that at least `pct` %
 * of the samples are less than or equal to it. Expects samples sorted ascending.
 */
export function percentile(sortedSamples: readonly number[], pct: number): number {
  if (sortedSamples.length === 0) throw new Error("percentile: no samples");
  if (pct <= 0 || pct > 100) throw new Error(`percentile: invalid percentage ${pct}`);
  const rank = Math.ceil((pct / 100) * sortedSamples.length);
  const value = sortedSamples[Math.min(rank, sortedSamples.length) - 1];
  if (value === undefined) throw new Error("percentile: rank out of range");
  return value;
}

/** p50/p95/p99 plus min, mean and max of a non-empty list of latencies. */
export function summarizeLatencies(samples: readonly number[]): LatencyStats {
  const sorted = [...samples].sort((left, right) => left - right);
  const [min] = sorted;
  if (min === undefined) throw new Error("summarizeLatencies: no samples");
  const total = sorted.reduce((sum, sample) => sum + sample, 0);
  return {
    count: sorted.length,
    min: round(min),
    mean: round(total / sorted.length),
    p50: round(percentile(sorted, 50)),
    p95: round(percentile(sorted, 95)),
    p99: round(percentile(sorted, 99)),
    max: round(percentile(sorted, 100)),
  };
}
