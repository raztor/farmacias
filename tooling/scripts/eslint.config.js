import { node } from "@repo/eslint-config/node";
import { defineConfig } from "eslint/config";

export default defineConfig(node, {
  languageOptions: { parserOptions: { tsconfigRootDir: import.meta.dirname } },
  rules: {
    // Scripts de CLI: escriben directo a stdout y leen process.env.
    "no-restricted-properties": "off",
  },
});
