import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";

import { LIMITS } from "./limits.js";

const parentImport = "../".repeat(LIMITS.maxParentImportDepth + 1);

/** Size/complexity rules: see docs/REPO_RULES.md §2. */
const limitRules = {
  "max-lines": ["error", { max: LIMITS.maxLinesPerFile, skipBlankLines: true, skipComments: true }],
  "max-lines-per-function": [
    "error",
    { max: LIMITS.maxLinesPerFunction, skipBlankLines: true, skipComments: true, IIFEs: true },
  ],
  complexity: ["error", LIMITS.complexity],
  "max-depth": ["error", LIMITS.maxDepth],
  "max-params": "off",
  "@typescript-eslint/max-params": ["error", { max: LIMITS.maxParams }],
  "max-nested-callbacks": ["error", LIMITS.maxNestedCallbacks],
};

const noEnum = {
  selector: "TSEnumDeclaration",
  message: "Usa un objeto `as const` o una unión de literales en vez de `enum`.",
};
const noExportAll = {
  selector: "ExportAllDeclaration[exported=null]",
  message: "Evita `export *`: exporta explícitamente la API pública.",
};
const noDefaultExport = {
  // Also catches the `export { x as default }` form.
  selector: "ExportDefaultDeclaration, ExportSpecifier[exported.name='default']",
  message: "Usa exports con nombre. `export default` solo donde el framework lo exige.",
};

/**
 * Files where the framework requires `export default` (Next.js / Expo Router routes,
 * stories and tool configs). The platform configs may extend the list.
 */
export const DEFAULT_EXPORT_ALLOWED = [
  "**/src/app/**/*.{ts,tsx}",
  "**/*.stories.{ts,tsx}",
  "**/*.config.{ts,js,mjs,cjs}",
  "**/.storybook/**",
];

/** Files that may read `process.env` directly (the rest use the validated `env`). */
export const PROCESS_ENV_ALLOWED = [
  "**/env.ts",
  "**/instrument.ts",
  "**/*.config.{ts,js,mjs,cjs}",
  "**/src/scripts/**",
  "**/e2e/**",
  "**/.storybook/**",
];

/** Module and import rules: see docs/REPO_RULES.md §3. */
const moduleRules = {
  "no-restricted-imports": [
    "error",
    {
      patterns: [
        {
          group: ["@repo/*/src", "@repo/*/src/**"],
          message: "Importa solo la API pública del paquete (lo que expone en `exports`).",
        },
        {
          group: [`${parentImport}*`],
          message: `Máximo ${LIMITS.maxParentImportDepth} niveles de "../". Expón el código vía el index del módulo.`,
        },
      ],
    },
  ],
  "no-restricted-syntax": ["error", noEnum, noExportAll, noDefaultExport],
  "no-restricted-properties": [
    "error",
    {
      object: "process",
      property: "env",
      message: "Lee variables desde el módulo `env.ts` validado con zod, no desde process.env.",
    },
  ],
};

/** TypeScript correctness and style rules. */
const typescriptRules = {
  "no-console": "error",
  eqeqeq: ["error", "smart"],
  "prefer-const": "error",
  "no-param-reassign": "error",
  "@typescript-eslint/consistent-type-imports": [
    "error",
    { prefer: "type-imports", fixStyle: "inline-type-imports" },
  ],
  "@typescript-eslint/no-import-type-side-effects": "error",
  "@typescript-eslint/no-unused-vars": [
    "error",
    { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
  ],
  "@typescript-eslint/no-misused-promises": ["error", { checksVoidReturn: { attributes: false } }],
  "@typescript-eslint/switch-exhaustiveness-check": "error",
  "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true }],
  "@typescript-eslint/consistent-type-definitions": ["error", "type"],
};

export const base = defineConfig(
  globalIgnores([
    "**/node_modules/**",
    "**/dist/**",
    "**/build/**",
    "**/.next/**",
    "**/.expo/**",
    "**/.turbo/**",
    "**/coverage/**",
    "**/storybook-static/**",
    "**/playwright-report/**",
    "**/test-results/**",
    "**/generated/**",
    "**/next-env.d.ts",
    "**/expo-env.d.ts",
    "**/nativewind-env.d.ts",
  ]),
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true },
    },
    linterOptions: { reportUnusedDisableDirectives: "error" },
    rules: { ...limitRules, ...moduleRules, ...typescriptRules },
  },
  {
    // Tests: long, nested scenarios are allowed.
    files: ["**/*.test.{ts,tsx}", "**/*.spec.{ts,tsx}", "**/e2e/**/*.ts"],
    rules: {
      "max-lines-per-function": "off",
      "max-nested-callbacks": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/unbound-method": "off",
    },
  },
  {
    files: DEFAULT_EXPORT_ALLOWED,
    rules: { "no-restricted-syntax": ["error", noEnum, noExportAll] },
  },
  {
    files: PROCESS_ENV_ALLOWED,
    rules: { "no-restricted-properties": "off" },
  },
  {
    // JS files (tool configs) are not type-checked.
    files: ["**/*.{js,cjs,mjs}"],
    extends: [tseslint.configs.disableTypeChecked],
    rules: { "@typescript-eslint/consistent-type-imports": "off" },
  },
  prettier,
);
