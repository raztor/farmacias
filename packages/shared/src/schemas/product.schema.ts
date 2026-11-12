import { z } from "zod";

import { PRODUCT_CATEGORIES } from "../domain/catalog";

export const PRODUCT_SKU_MIN_LENGTH = 3;
export const PRODUCT_SKU_MAX_LENGTH = 32;
export const PRODUCT_NAME_MAX_LENGTH = 120;
export const PRODUCT_PRESENTATION_MAX_LENGTH = 200;
/** Highest price accepted by the back office (CLP, no decimals). */
export const PRODUCT_PRICE_MAX_CLP = 9_999_999;

const SKU_PATTERN = /^[A-Z0-9]+(?:-[A-Z0-9]+)*$/;

/** Required trimmed text with a maximum length (Spanish messages for the admin form). */
const requiredText = (label: string, max: number) =>
  z
    .string({ error: `Ingresa ${label}` })
    .trim()
    .min(1, { error: `Ingresa ${label}` })
    .max(max, { error: `Máximo ${max} caracteres` });

/**
 * Stable business key of a product (`products.sku`, UNIQUE): trimmed and upper-cased, letters,
 * digits and single hyphens (e.g. `CAR-LOS50-B1`).
 */
export const productSkuSchema = z
  .string({ error: "Ingresa el SKU" })
  .trim()
  .toUpperCase()
  .min(PRODUCT_SKU_MIN_LENGTH, {
    error: `El SKU tiene al menos ${PRODUCT_SKU_MIN_LENGTH} caracteres`,
  })
  .max(PRODUCT_SKU_MAX_LENGTH, { error: `Máximo ${PRODUCT_SKU_MAX_LENGTH} caracteres` })
  .regex(SKU_PATTERN, { error: "Usa solo letras, números y guiones (por ejemplo CAR-LOS50-B1)" });

/** Price in Chilean pesos: an integer greater than 0 (CHECK `products_price_clp_check`). */
export const productPriceClpSchema = z
  .number({ error: "Ingresa el precio en pesos" })
  .int({ error: "El precio va en pesos, sin decimales" })
  .min(1, { error: "El precio debe ser mayor que 0" })
  .max(PRODUCT_PRICE_MAX_CLP, { error: "El precio no puede superar $9.999.999" });

/** Editable fields of a product (HU-11, D-28). Shared by the API and the admin form. */
export const productFieldsSchema = z.object({
  sku: productSkuSchema,
  commercialName: requiredText("el nombre comercial", PRODUCT_NAME_MAX_LENGTH),
  activeIngredient: requiredText("el principio activo", PRODUCT_NAME_MAX_LENGTH),
  presentation: requiredText("la presentación", PRODUCT_PRESENTATION_MAX_LENGTH),
  category: z.enum(PRODUCT_CATEGORIES, { error: "Elige una categoría" }),
  priceClp: productPriceClpSchema,
  active: z.boolean({ error: "Indica si el producto está activo" }),
});

export type ProductFields = z.output<typeof productFieldsSchema>;
export type ProductFieldsInput = z.input<typeof productFieldsSchema>;
