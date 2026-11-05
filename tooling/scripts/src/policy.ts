/**
 * Dependency policy of the monorepo (docs/REPO_RULES.md §4).
 * Enforced by `pnpm check:deps` locally and in CI.
 */

export type WorkspaceKind = "app" | "package" | "tooling";

export type DependencyLimits = {
  /** Maximum external `dependencies` (`@repo/*` packages not counted). */
  maxDependencies: number;
  /** Maximum external `devDependencies`. */
  maxDevDependencies: number;
};

export type LimitOverride = Partial<DependencyLimits> & {
  /** Every exception must be justified. */
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

/** Banned packages and the alternative to use. */
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

/** Workspaces that are not executable code and need no lint/typecheck scripts. */
export const CONFIG_ONLY_WORKSPACES = new Set([
  "@repo/tsconfig",
  "@repo/prettier-config",
  "@repo/eslint-config",
]);

export const REQUIRED_SCRIPTS = ["lint", "typecheck"] as const;
