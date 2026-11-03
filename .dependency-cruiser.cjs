/**
 * Reglas de arquitectura (docs/REPO_RULES.md §3). Se ejecutan con `pnpm check:arch`.
 * @type {import("dependency-cruiser").IConfiguration}
 */
module.exports = {
  forbidden: [
    {
      name: "no-circular",
      comment: "Los imports circulares acoplan módulos y rompen el orden de inicialización.",
      severity: "error",
      from: {},
      to: { circular: true },
    },
    {
      name: "no-app-to-app",
      comment: "Una app nunca importa código de otra app. Lo compartido va en packages/.",
      severity: "error",
      from: { path: "^apps/([^/]+)/" },
      to: { path: "^apps/([^/]+)/", pathNot: "^apps/$1/" },
    },
    {
      name: "no-package-to-app",
      comment: "Los paquetes no conocen a las apps que los consumen.",
      severity: "error",
      from: { path: "^packages/" },
      to: { path: "^apps/" },
    },
    {
      name: "api-module-public-api",
      comment: "Un módulo de @repo/api solo usa otro módulo a través de su index.ts.",
      severity: "error",
      from: { path: "^packages/api/src/modules/([^/]+)/" },
      to: {
        path: "^packages/api/src/modules/[^/]+/",
        pathNot: ["^packages/api/src/modules/$1/", "^packages/api/src/modules/[^/]+/index\\.ts$"],
      },
    },
    {
      name: "api-db-only-in-repositories",
      comment: "En @repo/api solo los *.repository.ts acceden a Prisma (los tipos sí se permiten).",
      severity: "error",
      from: {
        path: "^packages/api/src/modules/",
        pathNot: "\\.(repository|test)\\.ts$",
      },
      to: { path: "^packages/db/", dependencyTypesNot: ["type-only"] },
    },
    {
      name: "api-router-not-to-repository",
      comment: "Capas: router → service → repository. Un router no salta al repositorio.",
      severity: "error",
      from: { path: "\\.router\\.ts$" },
      to: { path: "\\.repository\\.ts$" },
    },
    {
      name: "feature-public-api",
      comment: "Una feature de una app solo usa otra feature a través de su index.ts.",
      severity: "error",
      from: { path: "^apps/([^/]+)/src/features/([^/]+)/" },
      to: {
        path: "^apps/[^/]+/src/features/[^/]+/",
        pathNot: ["^apps/$1/src/features/$2/", "^apps/$1/src/features/[^/]+/index\\.tsx?$"],
      },
    },
    {
      name: "no-import-tests",
      comment: "El código de producción no importa tests ni stories.",
      severity: "error",
      from: { pathNot: "\\.(test|spec|stories)\\.tsx?$|/e2e/|/\\.storybook/" },
      to: { path: "\\.(test|spec|stories)\\.tsx?$" },
    },
    {
      name: "not-to-dev-dep",
      comment: "El código de producción no usa devDependencies (salvo imports de solo tipos).",
      severity: "error",
      from: {
        path: "^(apps|packages)/[^/]+/src/",
        pathNot: "\\.(test|spec|stories)\\.tsx?$|/src/scripts/",
      },
      to: {
        dependencyTypes: ["npm-dev"],
        dependencyTypesNot: ["type-only"],
        pathNot: "node_modules/@types/",
      },
    },
    {
      name: "no-undeclared-dependency",
      comment: "Todo paquete importado debe estar declarado en el package.json del workspace.",
      severity: "error",
      from: {},
      to: { dependencyTypes: ["npm-no-pkg", "npm-unknown"] },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    exclude: {
      path: [
        "node_modules",
        "/dist/",
        "/\\.next/",
        "/\\.expo/",
        "/generated/",
        "storybook-static",
        "coverage",
        "\\.d\\.ts$",
      ],
    },
    tsPreCompilationDeps: true,
    detectJSDocImports: false,
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["types", "import", "require", "node", "react-native", "default"],
      mainFields: ["types", "module", "main"],
      extensions: [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json"],
    },
    reporterOptions: {
      text: { highlightFocused: true },
    },
  },
};
