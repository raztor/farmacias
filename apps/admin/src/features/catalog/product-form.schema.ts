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

/** "$6.990", "6 990" and "6990" are the same price: thousands separators and "$" are dropped. */
const PRICE_DECORATIONS = /[$.\s]/g;

const priceField = z
  .string()
  .transform((value) => value.replace(PRICE_DECORATIONS, ""))
  .pipe(
    z
      .string()
      .min(1, { error: "Ingresa el precio en pesos" })
      .regex(/^\d+$/, { error: "Escribe el precio en pesos, solo con números (sin decimales)" }),
  )
  .transform(Number)
  .pipe(productPriceClpSchema);

/**
 * Product form: the shared `productFieldsSchema` (same rules and messages as the API) with the
 * price and the active flag parsed from their text controls.
 */
export const productFormSchema = productFieldsSchema.extend({
  priceClp: priceField,
  active: z.enum(["true", "false"]).transform((value) => value === "true"),
});
