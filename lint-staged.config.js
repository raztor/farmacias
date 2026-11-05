/**
 * Pre-commit tasks (see docs/REPO_RULES.md §9). Runs from `.husky/pre-commit`.
 *
 * - Prettier formats every staged file it understands (`--ignore-unknown` skips the rest,
 *   `.prettierignore` is respected).
 * - When source files of any workspace change, the naming convention check runs once for the
 *   whole repo (it does not take file arguments, so the function form drops them).
 *
 * @type {import("lint-staged").Configuration}
 */
const config = {
  "*": "prettier --write --ignore-unknown",
  "{apps,packages,tooling}/*/{src,e2e,.maestro}/**": () =>
    "node tooling/scripts/src/check-naming.ts",
};

export default config;
