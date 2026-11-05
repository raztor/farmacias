import type { CategoryCatalog } from "./catalog-generator";

/** Supplements: ~9% of the demand. Brand names are invented (synthetic data, RNF-06). */
export const SUPLEMENTOS_CATALOG: CategoryCatalog = {
  category: "suplementos",
  prefix: "SUP",
  target: 18,
  ingredients: [
    {
      code: "MLT",
      activeIngredient: "Melatonina",
      brand: "Nocturna",
      variants: [
        ["Comprimidos 3 mg x 30", 6990],
        ["Comprimidos sublinguales 3 mg x 60", 11990],
      ],
    },
    {
      code: "MVT",
      activeIngredient: "Multivitamínico",
      brand: "Vitalcomún",
      variants: [
        ["Comprimidos x 30", 8990],
        ["Comprimidos x 60", 14990],
      ],
    },
    {
      code: "VD3",
      activeIngredient: "Vitamina D3 (colecalciferol)",
      brand: "Solvid",
      variants: [
        ["Cápsulas blandas 1.000 UI x 60", 7990],
        ["Gotas 400 UI/gota x 10 ml", 9990],
      ],
    },
    {
      code: "CAD",
      activeIngredient: "Calcio + vitamina D3",
      brand: "Calcidan",
      variants: [
        ["Comprimidos 600 mg/400 UI x 30", 6990],
        ["Comprimidos masticables 500 mg/200 UI x 60", 9990],
      ],
    },
    {
      code: "MAG",
      activeIngredient: "Magnesio citrato",
      brand: "Magnevid",
      variants: [
        ["Comprimidos 300 mg x 60", 8490],
        ["Polvo para solución 400 mg x 30 sobres", 10990],
      ],
    },
    {
      code: "OM3",
      activeIngredient: "Omega 3 (EPA + DHA)",
      brand: "Marinol Sur",
      variants: [
        ["Cápsulas blandas 1.000 mg x 60", 9990],
        ["Cápsulas blandas 1.000 mg x 120", 16990],
      ],
    },
  ],
};
