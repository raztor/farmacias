import { productFieldsSchema, productPriceClpSchema, type ProductFields } from "@repo/shared";
import { z } from "zod";

/** Raw values of the product form (every control holds a string). */
export type ProductFormValues = {
  sku: string;
  commercialName: string;
  activeIngredient: string;
  presentation: string;
  category: string;
  priceClp: string;
  /** Checkbox state: "true" or "false". */
  active: string;
};

/** A new product starts active, without category nor price. */
export const EMPTY_PRODUCT_FORM: ProductFormValues = {
  sku: "",
  commercialName: "",
  activeIngredient: "",
  presentation: "",
  category: "",
  priceClp: "",
  active: "true",
};

/** Form values of an existing product (edit page). */
export function productFormValues(product: ProductFields): ProductFormValues {
  return {
    sku: product.sku,
    commercialName: product.commercialName,
    activeIngredient: product.activeIngredient,
    presentation: product.presentation,
    category: product.category,
    priceClp: String(product.priceClp),
    active: product.active ? "true" : "false",
  };
}

/**
 * A price in pesos: plain digits ("6990") or proper CLP thousands groups ("6.990", "$1.250.000"),
 * optionally after "$". Anything else ("19.90", "1990.50", "1,5") would hide decimals or a typo,
 * so it is rejected instead of guessed.
 */
const CLP_PRICE_PATTERN = /^\$?\s*(?:\d{1,3}(?:\.\d{3})+|\d+)$/;
const PRICE_FORMAT_MESSAGE = "Escribe el precio en pesos, solo con números (sin decimales)";

const priceField = z
  .string()
  .trim()
  .pipe(
    z
      .string()
      .min(1, { error: "Ingresa el precio en pesos" })
      .regex(CLP_PRICE_PATTERN, { error: PRICE_FORMAT_MESSAGE }),
  )
  .transform((value) => Number(value.replace(/[$.\s]/g, "")))
  .pipe(productPriceClpSchema);

/**
 * Product form: the shared `productFieldsSchema` (same rules and messages as the API) with the
 * price and the active flag parsed from their text controls.
 */
export const productFormSchema = productFieldsSchema.extend({
  priceClp: priceField,
  active: z.enum(["true", "false"]).transform((value) => value === "true"),
});
