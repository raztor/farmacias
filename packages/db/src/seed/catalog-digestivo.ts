import type { CategoryCatalog } from "./catalog-generator";

/** Digestive: ~8% of the demand. Brand names are invented (synthetic data, RNF-06). */
export const DIGESTIVO_CATALOG: CategoryCatalog = {
  category: "digestivo",
  prefix: "DIG",
  target: 16,
  ingredients: [
    {
      code: "OME",
      activeIngredient: "Omeprazol",
      brand: "Gastrovar",
      variants: [
        ["Cápsulas 20 mg x 30", 3990],
        ["Cápsulas 40 mg x 30", 6990],
      ],
    },
    {
      code: "PAN",
      activeIngredient: "Pantoprazol",
      brand: "Pantogas",
      variants: [
        ["Comprimidos gastrorresistentes 20 mg x 28", 7990],
        ["Comprimidos gastrorresistentes 40 mg x 28", 11990],
      ],
    },
    {
      code: "DOM",
      activeIngredient: "Domperidona",
      brand: "Digestil",
      variants: [
        ["Comprimidos 10 mg x 30", 4990],
        ["Suspensión oral 1 mg/ml x 100 ml", 5990],
      ],
    },
    {
      code: "LOP",
      activeIngredient: "Loperamida",
      brand: "Diarrestop",
      variants: [
        ["Comprimidos 2 mg x 6", 1990],
        ["Comprimidos 2 mg x 12", 2990],
      ],
    },
    {
      code: "LAC",
      activeIngredient: "Lactulosa",
      brand: "Lactovid",
      variants: [
        ["Solución oral 65% x 200 ml", 6490],
        ["Solución oral 65% x 400 ml", 10490],
      ],
    },
  ],
};
