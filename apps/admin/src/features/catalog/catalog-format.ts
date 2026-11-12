import { PRODUCT_CATEGORY_LABELS, type ProductCategory } from "@repo/shared";

/** Product list of the back office (HU-11). */
export const CATALOG_PATH = "/catalog";
export const NEW_PRODUCT_PATH = "/catalog/new";

/** Edit page of a product. */
export function productHref(productId: string): string {
  return `${CATALOG_PATH}/${encodeURIComponent(productId)}`;
}

/** Spanish label of a therapeutic category. */
export function categoryLabel(category: ProductCategory): string {
  return PRODUCT_CATEGORY_LABELS[category];
}

/** Status shown as text (never color only, RNF-01). */
export function productStatusLabel(active: boolean): string {
  return active ? "Activo" : "Inactivo";
}

/** Units on hand, e.g. "Sin stock", "1 unidad", "12 unidades". */
export function stockLabel(onHand: number): string {
  if (onHand <= 0) return "Sin stock";
  return onHand === 1 ? "1 unidad" : `${String(onHand)} unidades`;
}

/** `true` when `latest` was saved after the version being edited (`base`), R-CAT-18. */
export function isNewerVersion(
  base: Readonly<{ updatedAt: Date }>,
  latest: Readonly<{ updatedAt: Date }>,
): boolean {
  return latest.updatedAt.getTime() > base.updatedAt.getTime();
}

/**
 * Whether a keydown reaching the product form should save it: Enter on a native checkbox (text
 * fields save through `onSubmitEditing`; selects keep Enter for their list). Not while an IME
 * composition is in progress.
 */
export function isCheckboxEnter(key: string, target: EventTarget | null, composing: boolean) {
  if (key !== "Enter" || composing || typeof target !== "object" || target === null) return false;
  return "type" in target && target.type === "checkbox";
}

/** Success toast after saving a product. */
export function productSavedMessage(name: string, kind: "created" | "updated"): string {
  return kind === "created" ? `Producto «${name}» creado.` : `Cambios de «${name}» guardados.`;
}
