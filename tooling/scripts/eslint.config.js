import { node } from "@repo/eslint-config/node";
import { defineConfig } from "eslint/config";

export default defineConfig(node, {
  languageOptions: { parserOptions: { tsconfigRootDir: import.meta.dirname } },
  rules: {
    // CLI scripts: they write straight to stdout and read process.env.
    "no-restricted-properties": "off",
  },
});
