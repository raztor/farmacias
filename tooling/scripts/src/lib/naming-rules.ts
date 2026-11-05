/**
 * Naming conventions of files and folders (docs/REPO_RULES.md §6).
 * Everything in kebab-case, with dotted suffixes: `user.service.ts`, `button.stories.tsx`.
 * The Next.js and Expo Router route syntax is allowed: `[id]`, `[...slug]`, `(group)`,
 * `@slot`, `_layout`, `+not-found`.
 */

const KEBAB_SEGMENT = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Strips the route syntax decorations and returns the "base" name. */
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
  if (name.startsWith(".")) return true; // configuration dotfiles
  // The stem may be a catch-all route with inner dots: `[...slug].tsx`.
  const match = /^(\[\[?\.\.\.[^\]]+\]\]?|[^.]+)\.(.+)$/.exec(name);
  if (!match) return false;
  const [, stem = "", rest = ""] = match;
  return isValidDirectoryName(stem) && rest.split(".").every((part) => KEBAB_SEGMENT.test(part));
}
