/**
 * Convenciones de nombres de archivos y carpetas (docs/REPO_RULES.md §6).
 * Todo en kebab-case, con sufijos con punto: `user.service.ts`, `button.stories.tsx`.
 * Se permite la sintaxis de rutas de Next.js y Expo Router: `[id]`, `[...slug]`, `(group)`,
 * `@slot`, `_layout`, `+not-found`.
 */

const KEBAB_SEGMENT = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Quita los adornos de sintaxis de rutas y devuelve el nombre "base". */
function stripRouteSyntax(name: string): string {
  return name
    .replace(/^\((.+)\)$/, "$1") // (group)
    .replace(/^\[\[?(?:\.\.\.)?(.+?)\]?\]$/, "$1") // [id], [...slug], [[...slug]]
    .replace(/^[@_+]/, ""); // @slot, _layout, +not-found
}

export function isValidDirectoryName(name: string): boolean {
  return KEBAB_SEGMENT.test(stripRouteSyntax(name));
}

export function isValidFileName(name: string): boolean {
  if (name.startsWith(".")) return true; // dotfiles de configuración
  // El stem puede ser una ruta catch-all con puntos internos: `[...slug].tsx`.
  const match = /^(\[\[?\.\.\.[^\]]+\]\]?|[^.]+)\.(.+)$/.exec(name);
  if (!match) return false;
  const [, stem = "", rest = ""] = match;
  return isValidDirectoryName(stem) && rest.split(".").every((part) => KEBAB_SEGMENT.test(part));
}
