import { defineConfig } from "eslint/config";
import globals from "globals";

import { base } from "./base.js";

/** Paquetes y apps que corren en Node.js (server, worker, db, queue...). */
export const node = defineConfig(base, {
  languageOptions: { globals: { ...globals.node } },
});
