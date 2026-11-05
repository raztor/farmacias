import { nextjs } from "@repo/eslint-config/nextjs";
import { defineConfig } from "eslint/config";

export default defineConfig(
  nextjs,
  {
    languageOptions: { parserOptions: { tsconfigRootDir: import.meta.dirname } },
    settings: { next: { rootDir: import.meta.dirname } },
  },
  {
    // Next.js instrumentation hook: must branch on the runtime (`NEXT_RUNTIME`) before any
    // module (including the validated env) is loaded. Same exception as `instrument.ts`.
    files: ["src/instrumentation.ts"],
    rules: { "no-restricted-properties": "off" },
  },
);
