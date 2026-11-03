/**
 * Política de dependencias del monorepo (docs/REPO_RULES.md §4).
 * Se aplica con `pnpm check:deps` en local y en CI.
 */

export type WorkspaceKind = "app" | "package" | "tooling";

export type DependencyLimits = {
  /** Máximo de `dependencies` externas (no cuenta paquetes `@repo/*`). */
  maxDependencies: number;
  /** Máximo de `devDependencies` externas. */
  maxDevDependencies: number;
};

export type LimitOverride = Partial<DependencyLimits> & {
  /** Toda excepción debe estar justificada. */
  reason: string;
};

export const INTERNAL_SCOPE = "@repo/";

export const DEFAULT_LIMITS: Record<WorkspaceKind, DependencyLimits> = {
  app: { maxDependencies: 20, maxDevDependencies: 15 },
  package: { maxDependencies: 8, maxDevDependencies: 10 },
  tooling: { maxDependencies: 8, maxDevDependencies: 10 },
};

export const LIMIT_OVERRIDES: Record<string, LimitOverride> = {
  "@repo/mobile": {
    maxDependencies: 35,
    reason: "Expo exige declarar cada módulo nativo como dependencia directa (autolinking).",
  },
  "@repo/observability": {
    maxDependencies: 12,
    reason:
      "OpenTelemetry se distribuye en varios paquetes pequeños (SDK, exporters, instrumentaciones y loader ESM).",
  },
  "@repo/storybook": {
    maxDevDependencies: 20,
    reason: "Storybook para React Native Web necesita el runtime nativo completo como devDeps.",
  },
};

/** Paquetes prohibidos y la alternativa a usar. */
export const BANNED_PACKAGES: Record<string, string> = {
  moment: "Usa Date/Intl nativos.",
  lodash: "Usa utilidades nativas de ES2024.",
  underscore: "Usa utilidades nativas de ES2024.",
  axios: "Usa fetch nativo.",
  "node-fetch": "fetch es nativo en Node 26.",
  request: "Paquete abandonado; usa fetch.",
  express: "La API usa Fastify.",
  jest: "Usa Vitest.",
  uuid: "Usa crypto.randomUUID().",
  "class-validator": "Valida con zod.",
  yup: "Valida con zod.",
  joi: "Valida con zod.",
  "@types/nodemailer": "nodemailer ya incluye sus tipos.",
};

/** Workspaces que no son código ejecutable y no requieren scripts lint/typecheck. */
export const CONFIG_ONLY_WORKSPACES = new Set([
  "@repo/tsconfig",
  "@repo/prettier-config",
  "@repo/eslint-config",
]);

export const REQUIRED_SCRIPTS = ["lint", "typecheck"] as const;
