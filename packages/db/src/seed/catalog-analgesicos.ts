import type { CategoryCatalog } from "./catalog-generator";

/** Analgesics and anti-inflammatories: ~14% of the demand. Invented brand names (RNF-06). */
export const ANALGESICOS_CATALOG: CategoryCatalog = {
  category: "analgesicos",
  prefix: "ANA",
  target: 28,
  ingredients: [
    {
      code: "CEL",
      activeIngredient: "Celecoxib",
      brand: "Celebrin Sur",
      variants: [
        ["Cápsulas 200 mg x 10", 7990],
        ["Cápsulas 200 mg x 30", 18990],
      ],
    },
    {
      code: "PAR",
      activeIngredient: "Paracetamol",
      brand: "Febrifin",
      variants: [
        ["Comprimidos 500 mg x 16", 1490],
        ["Jarabe 120 mg/5 ml x 100 ml", 2990],
      ],
    },
    {
      code: "IBU",
      activeIngredient: "Ibuprofeno",
      brand: "Ibufast",
      variants: [
        ["Comprimidos recubiertos 400 mg x 20", 2490],
        ["Cápsulas blandas 600 mg x 10", 3990],
      ],
    },
    {
      code: "NAP",
      activeIngredient: "Naproxeno sódico",
      brand: "Naprolen",
      variants: [
        ["Comprimidos recubiertos 550 mg x 10", 3490],
        ["Comprimidos recubiertos 275 mg x 20", 3990],
      ],
    },
    {
      code: "KET",
      activeIngredient: "Ketoprofeno",
      brand: "Ketoflam",
      variants: [
        ["Cápsulas 50 mg x 20", 4990],
        ["Gel 2,5% x 60 g", 6490],
      ],
    },
    {
      code: "DIC",
      activeIngredient: "Diclofenaco sódico",
      brand: "Diclomax",
      variants: [
        ["Comprimidos 50 mg x 20", 2990],
        ["Gel 1% x 50 g", 4990],
      ],
    },
    {
      code: "MTZ",
      activeIngredient: "Metamizol sódico",
      brand: "Dolomiz",
      variants: [
        ["Comprimidos 300 mg x 10", 1990],
        ["Gotas orales 500 mg/ml x 20 ml", 3490],
      ],
    },
    {
      code: "MEL",
      activeIngredient: "Meloxicam",
      brand: "Meloxan",
      variants: [
        ["Comprimidos 15 mg x 10", 3990],
        ["Comprimidos 7,5 mg x 20", 4490],
      ],
    },
  ],
};
