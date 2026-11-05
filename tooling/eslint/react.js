import eslintReact from "@eslint-react/eslint-plugin";
import reactHooks from "eslint-plugin-react-hooks";
import { defineConfig } from "eslint/config";
import globals from "globals";

import { base } from "./base.js";

/** Shared React code (packages/ui and the base of the apps). */
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
      // Incomplete hook dependencies are bugs, not warnings.
      "react-hooks/exhaustive-deps": "error",
    },
  },
);
