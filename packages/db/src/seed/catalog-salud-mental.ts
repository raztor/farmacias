import type { CategoryCatalog } from "./catalog-generator";

/** Mental health: ~22% of the demand. Brand names are invented (synthetic data, RNF-06). */
export const SALUD_MENTAL_CATALOG: CategoryCatalog = {
  category: "salud-mental",
  prefix: "SME",
  target: 44,
  ingredients: [
    {
      code: "PRE",
      activeIngredient: "Pregabalina",
      brand: "Pregalis",
      variants: [
        ["Cápsulas 75 mg x 28", 12990],
        ["Cápsulas 150 mg x 28", 19990],
      ],
    },
    {
      code: "ESC",
      activeIngredient: "Escitalopram",
      brand: "Escitavir",
      variants: [
        ["Comprimidos recubiertos 10 mg x 28", 11990],
        ["Comprimidos recubiertos 20 mg x 28", 17990],
      ],
    },
    {
      code: "SER",
      activeIngredient: "Sertralina",
      brand: "Sertrapaz",
      variants: [
        ["Comprimidos 50 mg x 30", 8990],
        ["Comprimidos 100 mg x 30", 13990],
      ],
    },
    {
      code: "FLU",
      activeIngredient: "Fluoxetina",
      brand: "Fluoxen",
      variants: [
        ["Cápsulas 20 mg x 30", 4990],
        ["Comprimidos dispersables 20 mg x 30", 6990],
      ],
    },
    {
      code: "QUE",
      activeIngredient: "Quetiapina",
      brand: "Quetiamar",
      variants: [
        ["Comprimidos recubiertos 25 mg x 30", 9990],
        ["Comprimidos recubiertos 100 mg x 30", 18990],
      ],
    },
    {
      code: "VEN",
      activeIngredient: "Venlafaxina",
      brand: "Venlacor",
      variants: [
        ["Cápsulas de liberación prolongada 75 mg x 30", 15990],
        ["Cápsulas de liberación prolongada 150 mg x 30", 23990],
      ],
    },
    {
      code: "BUP",
      activeIngredient: "Bupropión",
      brand: "Bupraleve",
      variants: [
        ["Comprimidos de liberación prolongada 150 mg x 30", 16990],
        ["Comprimidos de liberación prolongada 300 mg x 30", 25990],
      ],
    },
    {
      code: "TRA",
      activeIngredient: "Trazodona",
      brand: "Trazonia",
      variants: [
        ["Comprimidos 50 mg x 30", 7990],
        ["Comprimidos 100 mg x 30", 11990],
      ],
    },
    {
      code: "PAR",
      activeIngredient: "Paroxetina",
      brand: "Paroxal",
      variants: [
        ["Comprimidos recubiertos 20 mg x 30", 9490],
        ["Comprimidos recubiertos 20 mg x 10", 3990],
      ],
    },
    {
      code: "MIR",
      activeIngredient: "Mirtazapina",
      brand: "Mirtazen",
      variants: [
        ["Comprimidos recubiertos 15 mg x 30", 10990],
        ["Comprimidos recubiertos 30 mg x 30", 15990],
      ],
    },
    {
      code: "LAM",
      activeIngredient: "Lamotrigina",
      brand: "Lamotral",
      variants: [
        ["Comprimidos 50 mg x 30", 9990],
        ["Comprimidos 100 mg x 30", 14990],
      ],
    },
    {
      code: "DUL",
      activeIngredient: "Duloxetina",
      brand: "Duloxa",
      variants: [
        ["Cápsulas 30 mg x 28", 17990],
        ["Cápsulas 60 mg x 28", 26990],
      ],
    },
  ],
};
