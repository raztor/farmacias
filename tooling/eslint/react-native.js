import { defineConfig } from "eslint/config";

import { react } from "./react.js";

/** Expo / React Native app. */
export const reactNative = defineConfig(react, {
  languageOptions: {
    globals: { __DEV__: "readonly" },
  },
  rules: {
    // `window`/`document` do not exist on native.
    "no-restricted-globals": ["error", "window", "document", "localStorage"],
  },
});
