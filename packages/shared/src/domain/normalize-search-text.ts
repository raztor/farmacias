const COMBINING_MARKS = /\p{M}+/gu;
const NON_ALPHANUMERIC = /[^a-z0-9]+/g;

/**
 * Normalizes free text for accent and case insensitive search (RF-01, RF-02):
 * lowercase, accents removed ("Losartán" → "losartan", "ñ" → "n"), every run of characters
 * other than `a-z`/`0-9` collapsed to one space, trimmed.
 *
 * The server stores `products.search_text` with this function and normalizes the query the
 * same way, so both sides always agree. Pure and dependency free (safe for clients).
 */
export function normalizeSearchText(text: string): string {
  return text
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .toLowerCase()
    .replace(NON_ALPHANUMERIC, " ")
    .trim();
}

/** Fields of a product that feed its search text. */
export type SearchableProduct = {
  commercialName: string;
  activeIngredient: string;
  presentation: string;
};

/** Value of `products.search_text`: commercial name + active ingredient + presentation. */
export function buildProductSearchText(product: SearchableProduct): string {
  return normalizeSearchText(
    `${product.commercialName} ${product.activeIngredient} ${product.presentation}`,
  );
}
