import { randomUUID } from "node:crypto";

import type { ApiSession } from "./api-session.ts";
import { isRecord, type JsonRecord } from "./trpc-http.ts";

/**
 * Products the catalog maintenance spec (HU-11) creates. Their commercial name and SKU start
 * with this prefix, so read-only specs that pick products from the live catalog can skip them
 * (`isE2eProduct`): they exist only while a test runs and get deactivated afterwards.
 */
export const E2E_PRODUCT_PREFIX = "E2E HU11";

/** `true` for a temporary product of the catalog maintenance spec. */
export function isE2eProduct(product: Readonly<{ commercialName: string }>): boolean {
  return product.commercialName.startsWith(E2E_PRODUCT_PREFIX);
}

/**
 * Data of a temporary product. The tag is letters only: one search word no other product
 * contains (R-CAT-03 would split a letters-and-digits tag into pieces common to the whole
 * catalog). No accents anywhere, so specs that pick accented products never see it.
 */
export function syntheticProduct() {
  const tag = randomUUID()
    .replace(/-/g, "")
    .slice(0, 10)
    .replace(/\d/g, (digit) => "ghijklmnop".charAt(Number(digit)))
    .toUpperCase();
  return {
    tag,
    sku: `${E2E_PRODUCT_PREFIX.replace(" ", "-")}-${tag}`,
    commercialName: `${E2E_PRODUCT_PREFIX} ${tag}`,
    activeIngredient: "Principio sintetico E2E",
    presentation: "Comprimidos 500 mg x 16",
  };
}

const UPDATE_FIELDS = [
  "id",
  "sku",
  "commercialName",
  "activeIngredient",
  "presentation",
  "category",
  "priceClp",
] as const;

/**
 * `catalog.update` with `active: false`. The API uses superjson: the loaded `updatedAt` (an ISO
 * string in the JSON output) goes back as a `Date` through the superjson `meta`.
 */
async function deactivate(admin: ApiSession, item: JsonRecord): Promise<void> {
  const fields = Object.fromEntries(UPDATE_FIELDS.map((key) => [key, item[key]]));
  const response = await admin.request.post("/trpc/catalog.update", {
    data: {
      json: { ...fields, active: false, expectedUpdatedAt: item.updatedAt },
      meta: { values: { expectedUpdatedAt: ["Date"] } },
    },
  });
  if (!response.ok()) {
    throw new Error(`Could not deactivate ${String(item.sku)}: HTTP ${String(response.status())}`);
  }
}

/** Deactivates every active temporary product whose name contains `tag` (test cleanup). */
export async function deactivateE2eProducts(admin: ApiSession, tag: string): Promise<void> {
  const result = await admin.trpc.query("catalog.adminList", { q: tag, status: "active" });
  const items = isRecord(result) && Array.isArray(result.items) ? result.items : [];
  for (const item of items.filter(isRecord)) {
    const name = item.commercialName;
    if (typeof name === "string" && isE2eProduct({ commercialName: name })) {
      await deactivate(admin, item);
    }
  }
}
