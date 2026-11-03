import eslintReact from "@eslint-react/eslint-plugin";
import reactHooks from "eslint-plugin-react-hooks";
import { defineConfig } from "eslint/config";
import globals from "globals";

import { base } from "./base.js";

/** Código React compartido (packages/ui y base de las apps). */
export const react = defineConfig(
  base,
  {
    files: ["**/*.{ts,tsx}"],
    extends: [eslintReact.configs["recommended-type-checked"]],
  },
  reactHooks.configs.flat["recommended-latest"],
  {
    languageOptions: { globals: { ...globals.browser } },
    rules: {
      // Dependencias de hooks incompletas son bugs, no advertencias.
      "react-hooks/exhaustive-deps": "error",
    },
  },
);
