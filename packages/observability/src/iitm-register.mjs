/**
 * Re-exports the synchronous loader of `import-in-the-middle` (a dependency of this package). It
 * ships `register-hooks.d.ts` next to `register-hooks.mjs` without an `exports` map, so
 * TypeScript looks for `register-hooks.d.mts` and treats a direct import as untyped;
 * `iitm-register.d.mts` points TypeScript at the real declarations instead. The specifier stays
 * bare (not a resolved path) so the app bundles rewrite it to this package's `node_modules`.
 */
export { register, supportsSyncHooks } from "import-in-the-middle/register-hooks.mjs";
