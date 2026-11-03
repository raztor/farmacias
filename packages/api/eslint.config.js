import { base } from "@repo/eslint-config/base";
import { defineConfig } from "eslint/config";

// `base` (not `node`): @repo/api must stay free of Node globals because admin and mobile
// (iOS, Android and web) type-check `AppRouter` from it.
export default defineConfig(base, {
  languageOptions: { parserOptions: { tsconfigRootDir: import.meta.dirname } },
});
