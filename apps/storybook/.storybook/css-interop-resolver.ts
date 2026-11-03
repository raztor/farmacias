import type { Plugin } from "vite";

const CSS_INTEROP_IMPORT = /^react-native-css-interop(?:\/.*)?$/;

/**
 * NativeWind's Babel preset injects imports of `react-native-css-interop` (its JSX runtime and
 * `createInteropElement`) into every transpiled file. With pnpm only `nativewind` itself can
 * resolve that package, so files outside this workspace (the @repo/ui sources) cannot. When the
 * regular resolution fails, this plugin resolves the import from NativeWind's own location.
 */
export function cssInteropResolver(): Plugin {
  let nativewindEntry: string | undefined;

  return {
    name: "repo:css-interop-resolver",
    enforce: "pre",
    async resolveId(source, importer, options) {
      if (importer === undefined || !CSS_INTEROP_IMPORT.test(source)) return null;

      const direct = await this.resolve(source, importer, { ...options, skipSelf: true });
      if (direct) return direct;

      nativewindEntry ??= (
        await this.resolve("nativewind", importer, { ...options, skipSelf: true })
      )?.id;
      if (nativewindEntry === undefined) {
        this.error(`Cannot resolve "${source}": "nativewind" is not resolvable from ${importer}.`);
      }
      return this.resolve(source, nativewindEntry, { ...options, skipSelf: true });
    },
  };
}
