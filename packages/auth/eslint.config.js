import { node } from "@repo/eslint-config/node";
import { defineConfig } from "eslint/config";

export default defineConfig(node, {
  languageOptions: { parserOptions: { tsconfigRootDir: import.meta.dirname } },
});
