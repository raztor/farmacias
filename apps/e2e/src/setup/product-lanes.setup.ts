import { expect, test } from "../support/fixtures.ts";
import { PRODUCT_LANES, laneSnapshot } from "../support/orders-api.ts";
import { writeLaneSnapshot } from "../support/product-lanes.ts";

/**
 * `e2e-setup` project: takes the product lane snapshot once, before any spec runs (every browser
 * and accessibility project depends on it), so a lane index means the same product for the
 * whole run (`src/support/product-lanes.ts`).
 */
test("toma la foto de los carriles de productos de esta ejecución", async ({ publicApi }) => {
  const ids = await laneSnapshot(publicApi);
  // The last lane (repeat order) reaches 14 slots (`mobileWebSlot`): with fewer products the
  // E2E database has to be re-seeded (docs/validation/e2e.md).
  expect(ids.length, "productos con stock para los carriles").toBeGreaterThanOrEqual(
    PRODUCT_LANES.repeatOrder + 14,
  );
  await writeLaneSnapshot(ids);
});
