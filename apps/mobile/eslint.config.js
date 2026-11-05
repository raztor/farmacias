import { reactNative } from "@repo/eslint-config/react-native";
import { defineConfig } from "eslint/config";

export default defineConfig(reactNative, {
  languageOptions: { parserOptions: { tsconfigRootDir: import.meta.dirname } },
});
