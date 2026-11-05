import { defineConfig } from "eslint/config";
import globals from "globals";

import { base } from "./base.js";

/** Packages and apps that run on Node.js (server, worker, db, queue...). */
export const node = defineConfig(base, {
  languageOptions: { globals: { ...globals.node } },
});
