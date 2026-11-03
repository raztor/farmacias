import type { CategoryCatalog } from "./catalog-generator";

/** Cardiovascular: ~26% of the demand. Brand names are invented (synthetic data, RNF-06). */
export const CARDIOVASCULAR_CATALOG: CategoryCatalog = {
  category: "cardiovascular",
  prefix: "CAR",
  target: 52,
  ingredients: [
    {
      code: "LOS",
      activeIngredient: "Losartán potásico",
      brand: "Tensivar",
      variants: [
        ["Comprimidos recubiertos 50 mg x 30", 6990],
        ["Comprimidos recubiertos 100 mg x 30", 10990],
      ],
    },
    {
      code: "ENA",
      activeIngredient: "Enalapril maleato",
      brand: "Enalvir",
      variants: [
        ["Comprimidos 10 mg x 20", 3990],
        ["Comprimidos 20 mg x 30", 5490],
      ],
    },
    {
      code: "AML",
      activeIngredient: "Amlodipino",
      brand: "Amlocord",
      variants: [
        ["Comprimidos 5 mg x 30", 4990],
        ["Comprimidos 10 mg x 30", 7490],
      ],
    },
    {
      code: "ATO",
      activeIngredient: "Atorvastatina",
      brand: "Lipostat Andes",
      variants: [
        ["Comprimidos recubiertos 20 mg x 30", 8990],
        ["Comprimidos recubiertos 40 mg x 30", 13990],
      ],
    },
    {
      code: "ROS",
      activeIngredient: "Rosuvastatina",
      brand: "Rosuvel",
      variants: [
        ["Comprimidos 10 mg x 30", 11990],
        ["Comprimidos 20 mg x 30", 16990],
      ],
    },
    {
      code: "MET",
      activeIngredient: "Metoprolol tartrato",
      brand: "Metocard",
      variants: [
        ["Comprimidos 50 mg x 30", 4490],
        ["Comprimidos 100 mg x 30", 6490],
      ],
    },
    {
      code: "CAR",
      activeIngredient: "Carvedilol",
      brand: "Carvelan",
      variants: [
        ["Comprimidos 6,25 mg x 30", 5990],
        ["Comprimidos 25 mg x 30", 8990],
      ],
    },
    {
      code: "VAL",
      activeIngredient: "Valsartán",
      brand: "Valtenso",
      variants: [
        ["Comprimidos recubiertos 80 mg x 28", 9990],
        ["Comprimidos recubiertos 160 mg x 28", 14990],
      ],
    },
    {
      code: "HCT",
      activeIngredient: "Hidroclorotiazida",
      brand: "Diurecin",
      variants: [
        ["Comprimidos 25 mg x 20", 2990],
        ["Comprimidos 50 mg x 20", 3990],
      ],
    },
    {
      code: "AAS",
      activeIngredient: "Ácido acetilsalicílico",
      brand: "Cardiopirin",
      variants: [
        ["Comprimidos 100 mg x 30", 2490],
        ["Comprimidos 100 mg x 100", 5990],
      ],
    },
    {
      code: "CLO",
      activeIngredient: "Clopidogrel",
      brand: "Plaquevir",
      variants: [
        ["Comprimidos recubiertos 75 mg x 28", 12990],
        ["Comprimidos recubiertos 75 mg x 14", 7990],
      ],
    },
    {
      code: "ESP",
      activeIngredient: "Espironolactona",
      brand: "Espiral",
      variants: [
        ["Comprimidos 25 mg x 20", 4990],
        ["Comprimidos 100 mg x 20", 9990],
      ],
    },
    {
      code: "FUR",
      activeIngredient: "Furosemida",
      brand: "Furocard",
      variants: [
        ["Comprimidos 40 mg x 12", 1990],
        ["Comprimidos 40 mg x 30", 3490],
      ],
    },
    {
      code: "BIS",
      activeIngredient: "Bisoprolol fumarato",
      brand: "Bisocor",
      variants: [
        ["Comprimidos 2,5 mg x 30", 6990],
        ["Comprimidos 5 mg x 30", 9490],
      ],
    },
  ],
};
