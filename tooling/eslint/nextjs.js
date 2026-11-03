import nextPlugin from "@next/eslint-plugin-next";
import { defineConfig } from "eslint/config";
import globals from "globals";

import { react } from "./react.js";

/** Apps Next.js (admin). */
export const nextjs = defineConfig(react, nextPlugin.configs["core-web-vitals"], {
  languageOptions: { globals: { ...globals.node } },
});
