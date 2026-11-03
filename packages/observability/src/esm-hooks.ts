import { register, supportsSyncHooks } from "./iitm-register.mjs";

/**
 * Node.js built-ins patched by the HTTP instrumentation. `import-in-the-middle` matches them by
 * specifier (`http` and `node:http` both resolve to `node:http`).
 */
const INSTRUMENTED_BUILTINS = ["http", "https"] as const;

/**
 * Third-party packages with an OpenTelemetry instrumentation enabled in `tracing.ts` that may be
 * imported from ESM code. They are matched by resolved file URL, not by specifier, because the
 * tsup bundles of the apps rewrite bare imports into relative paths
 * (`../../../packages/db/node_modules/pg/...`). Add a package here when enabling an
 * instrumentation for a library that ESM code imports directly.
 */
const INSTRUMENTED_PACKAGES = ["pg", "pg-pool", "ioredis", "undici"] as const;

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Matches any file inside `node_modules/<package>/` for the instrumented packages. */
export const INSTRUMENTED_PACKAGE_URL = new RegExp(
  `/node_modules/(?:${INSTRUMENTED_PACKAGES.map(escapeRegExp).join("|")})/`,
);

export type EsmHooksStatus = "registered" | "already-registered" | "unsupported";

let status: EsmHooksStatus | undefined;

/**
 * Lets OpenTelemetry instrumentations patch modules loaded through the ESM loader (`import`),
 * which `require-in-the-middle` alone cannot see. Registers `import-in-the-middle` as a
 * synchronous, in-thread loader hook (`module.registerHooks()`): Node.js 26 deprecates the
 * off-thread `module.register()` that `@opentelemetry/instrumentation/hook.mjs` relies on
 * (DEP0205), and Sentry's runtime injection uses the same synchronous API.
 *
 * Only the instrumented modules are intercepted ({@link INSTRUMENTED_PACKAGE_URL} plus `http` and
 * `https`), so the rest of the module graph loads untouched. It must run before those modules are
 * imported: call it from the file preloaded with `node --import`, before starting the SDK.
 * `initObservability` already does so when an OTLP endpoint is configured. Idempotent.
 */
export function registerEsmHooks(): EsmHooksStatus {
  if (status !== undefined) {
    return status === "unsupported" ? status : "already-registered";
  }
  if (!supportsSyncHooks()) {
    process.emitWarning(
      "OpenTelemetry ESM hooks need module.registerHooks() (Node.js >= 26); modules imported " +
        "with `import` will not be instrumented.",
      { code: "REPO_OBSERVABILITY_ESM_HOOKS" },
    );
    status = "unsupported";
    return status;
  }
  register({ include: [...INSTRUMENTED_BUILTINS, INSTRUMENTED_PACKAGE_URL] });
  status = "registered";
  return status;
}
