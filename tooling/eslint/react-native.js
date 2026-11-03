import { defineConfig } from "eslint/config";

import { react } from "./react.js";

/** App Expo / React Native. */
export const reactNative = defineConfig(react, {
  languageOptions: {
    globals: { __DEV__: "readonly" },
  },
  rules: {
    // `window`/`document` no existen en nativo.
    "no-restricted-globals": ["error", "window", "document", "localStorage"],
  },
});
