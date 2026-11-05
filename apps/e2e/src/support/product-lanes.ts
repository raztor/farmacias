import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

/**
 * Snapshot of the product lanes for one Playwright run (see `PRODUCT_LANES` in `orders-api.ts`).
 *
 * The lanes index a list of products with stock. Building that list from the live stock on every
 * `pickProduct` made it shift during the run: when a test paid for a product that had exactly
 * `LANE_MIN_QTY` units, the product left the list and every later index moved to the next
 * product, so tests running at the same time could share one. The `e2e-setup` project
 * (`src/setup/product-lanes.setup.ts`) now writes the list once, before any test runs; every
 * worker reads that same file, so an index means the same product for the whole run.
 */

/** Units a product needs at the start of the run to get a lane slot. */
export const LANE_MIN_QTY = 5;

/** Git-ignored (`.cache/`); rewritten by the `e2e-setup` project on every run. */
export const LANE_SNAPSHOT_FILE = join(import.meta.dirname, "../../.cache/product-lanes.json");

/** Writes the ordered product ids of this run. */
export async function writeLaneSnapshot(ids: readonly string[]): Promise<void> {
  await mkdir(dirname(LANE_SNAPSHOT_FILE), { recursive: true });
  await writeFile(LANE_SNAPSHOT_FILE, JSON.stringify(ids), "utf8");
}

/** Validates the snapshot file (an array of product ids). */
export function parseLaneSnapshot(raw: string): readonly string[] {
  const value: unknown = JSON.parse(raw);
  if (!Array.isArray(value) || !value.every((id: unknown) => typeof id === "string")) {
    throw new Error(`${LANE_SNAPSHOT_FILE} is not an array of product ids`);
  }
  return value.filter((id: unknown): id is string => typeof id === "string");
}

let snapshot: Promise<readonly string[]> | undefined;

/** The snapshot of this run, read once per worker. */
export function readLaneSnapshot(): Promise<readonly string[]> {
  snapshot ??= readFile(LANE_SNAPSHOT_FILE, "utf8").then(parseLaneSnapshot, (error: unknown) => {
    throw new Error(
      `Missing ${LANE_SNAPSHOT_FILE}: the "e2e-setup" project writes it before the specs run ` +
        "(do not pass --no-deps).",
      { cause: error },
    );
  });
  return snapshot;
}
