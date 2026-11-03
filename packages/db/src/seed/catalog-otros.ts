import type { CategoryCatalog } from "./catalog-generator";

/** Other therapeutic groups: ~21% of the demand. Invented brand names (RNF-06). */
export const OTROS_CATALOG: CategoryCatalog = {
  category: "otros",
  prefix: "OTR",
  target: 42,
  ingredients: [
    {
      code: "MTF",
      activeIngredient: "Metformina",
      brand: "Glucofin",
      variants: [
        ["Comprimidos 850 mg x 30", 3490],
        ["Comprimidos de liberación prolongada 1.000 mg x 30", 7990],
      ],
    },
    {
      code: "LEV",
      activeIngredient: "Levotiroxina sódica",
      brand: "Tiroxal",
      variants: [
        ["Comprimidos 50 mcg x 50", 5990],
        ["Comprimidos 100 mcg x 50", 7490],
      ],
    },
    {
      code: "LOR",
      activeIngredient: "Loratadina",
      brand: "Alerfin",
      variants: [
        ["Comprimidos 10 mg x 30", 2990],
        ["Jarabe 5 mg/5 ml x 60 ml", 3490],
      ],
    },
    {
      code: "CET",
      activeIngredient: "Cetirizina",
      brand: "Cetiral",
      variants: [
        ["Comprimidos 10 mg x 30", 3490],
        ["Gotas orales 10 mg/ml x 15 ml", 4490],
      ],
    },
    {
      code: "SAL",
      activeIngredient: "Salbutamol",
      brand: "Respirol",
      variants: [
        ["Inhalador 100 mcg/dosis x 200 dosis", 5990],
        ["Solución para nebulizar 5 mg/ml x 20 ml", 4990],
      ],
    },
    {
      code: "MON",
      activeIngredient: "Montelukast",
      brand: "Montair",
      variants: [
        ["Comprimidos recubiertos 10 mg x 30", 12990],
        ["Comprimidos masticables 5 mg x 30", 10990],
      ],
    },
    {
      code: "PRD",
      activeIngredient: "Prednisona",
      brand: "Predniflam",
      variants: [
        ["Comprimidos 5 mg x 20", 2490],
        ["Comprimidos 20 mg x 10", 3490],
      ],
    },
    {
      code: "AMX",
      activeIngredient: "Amoxicilina",
      brand: "Amoxilan",
      variants: [
        ["Cápsulas 500 mg x 21", 4990],
        ["Suspensión oral 250 mg/5 ml x 60 ml", 3990],
      ],
    },
    {
      code: "ALO",
      activeIngredient: "Alopurinol",
      brand: "Urinol",
      variants: [
        ["Comprimidos 100 mg x 30", 2990],
        ["Comprimidos 300 mg x 30", 4990],
      ],
    },
    {
      code: "TAM",
      activeIngredient: "Tamsulosina",
      brand: "Prostalib",
      variants: [
        ["Cápsulas de liberación prolongada 0,4 mg x 30", 11990],
        ["Cápsulas de liberación prolongada 0,4 mg x 10", 4990],
      ],
    },
    {
      code: "CLT",
      activeIngredient: "Clotrimazol",
      brand: "Micoderm",
      variants: [
        ["Crema 1% x 20 g", 2990],
        ["Solución tópica 1% x 20 ml", 3490],
      ],
    },
    {
      code: "FLT",
      activeIngredient: "Fluticasona propionato",
      brand: "Nasoflu",
      variants: [
        ["Spray nasal 50 mcg/dosis x 120 dosis", 9990],
        ["Spray nasal 50 mcg/dosis x 60 dosis", 6490],
      ],
    },
  ],
};
