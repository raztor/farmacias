import { readFileSync, realpathSync } from "node:fs";
import { isBuiltin } from "node:module";
import { join, relative, resolve, sep } from "node:path";

import { defineConfig, type Options } from "tsup";

type EsbuildPlugin = NonNullable<Options["esbuildPlugins"]>[number];

const ROOT = import.meta.dirname;
const OUT_DIR = join(ROOT, "dist");
const WORKSPACE_PACKAGES = resolve(ROOT, "../../packages") + sep;

const packageJson = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as {
  dependencies?: Record<string, string>;
};
const OWN_DEPENDENCIES = new Set(Object.keys(packageJson.dependencies ?? {}));

/** `@scope/name/sub` -> `@scope/name`; `name/sub` -> `name`. */
const packageNameOf = (specifier: string): string => {
  const parts = specifier.split("/");
  return (specifier.startsWith("@") ? parts.slice(0, 2) : parts.slice(0, 1)).join("/");
};

/** Directory of the workspace package (`packages/<name>`) that contains `file`. */
const workspacePackageDirOf = (file: string): string => {
  const [name = ""] = file.slice(WORKSPACE_PACKAGES.length).split(sep);
  return join(WORKSPACE_PACKAGES, name);
};

const toImportPath = (target: string): string => {
  const path = relative(OUT_DIR, target).split(sep).join("/");
  return path.startsWith(".") ? path : `./${path}`;
};

/**
 * Internal `@repo/*` packages are TypeScript source, so they are bundled. Their own third-party
 * dependencies (pino, Sentry, OpenTelemetry...) must NOT be bundled (they load files and
 * optional modules at runtime and instrumentation patches them through the module loader), but
 * they are not resolvable from this app's `node_modules` either (pnpm isolates them).
 *
 * This plugin keeps those imports external and rewrites them to the file inside the declaring
 * package's `node_modules` (e.g. `../../../packages/observability/node_modules/pino/pino.js`),
 * which is exactly what Node would load had the package not been bundled. The runtime image must
 * therefore keep the pruned workspace layout (`apps/worker` + `packages/*` with `node_modules`).
 */
const externalWorkspaceDependencies = (): EsbuildPlugin => ({
  name: "external-workspace-dependencies",
  setup(build) {
    build.onResolve({ filter: /^[^./]/ }, async (args) => {
      const isWorkspaceImporter = args.importer.startsWith(WORKSPACE_PACKAGES);
      const name = packageNameOf(args.path);
      const skip =
        args.pluginData === "skip" ||
        !isWorkspaceImporter ||
        isBuiltin(args.path) ||
        name.startsWith("@repo/") ||
        OWN_DEPENDENCIES.has(name);
      if (skip) return undefined;

      const resolved = await build.resolve(args.path, {
        kind: args.kind,
        importer: args.importer,
        resolveDir: args.resolveDir,
        pluginData: "skip",
      });
      if (resolved.errors.length > 0) return { errors: resolved.errors };

      const linkedDir = join(workspacePackageDirOf(args.importer), "node_modules", name);
      const realDir = realpathSync(linkedDir);
      const target = join(linkedDir, relative(realDir, resolved.path));
      return { path: toImportPath(target), external: true };
    });
  },
});

/**
 * Production bundle: `instrument` is preloaded with `node --import` so observability starts
 * before any instrumented module loads. Shared code lands in chunks so both entries use the
 * same module instances (env, Sentry client...).
 */
export default defineConfig({
  entry: { index: "src/index.ts", instrument: "src/instrument.ts" },
  format: ["esm"],
  platform: "node",
  target: "node26",
  outDir: "dist",
  clean: true,
  sourcemap: true,
  splitting: true,
  noExternal: [/^@repo\//],
  esbuildPlugins: [externalWorkspaceDependencies()],
  esbuildOptions: (options) => {
    // tsup prefers the `module` field on Node, but Node itself ignores it. Resolving external
    // packages the way Node does matters: e.g. bullmq's `module` build uses directory imports
    // that Node's ESM loader rejects, while its `main` (CommonJS) build loads fine.
    options.mainFields = ["main"];
  },
});
