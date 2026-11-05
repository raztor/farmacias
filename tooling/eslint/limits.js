/**
 * Size and complexity limits of the repository.
 * Single source: docs/REPO_RULES.md documents them and ESLint enforces them as `error`.
 * Changing them requires an ADR (docs/adr).
 */
export const LIMITS = Object.freeze({
  /** Lines per file (blank lines and comments not counted). */
  maxLinesPerFile: 300,
  /** Lines per function or component. */
  maxLinesPerFunction: 60,
  /** Cyclomatic complexity per function. */
  complexity: 12,
  /** Nested blocks (if/for/while/try) per function. */
  maxDepth: 4,
  /** Parameters per function (use an object when more are needed). */
  maxParams: 4,
  /** Nested callbacks. */
  maxNestedCallbacks: 3,
  /** Levels of `../` allowed in a relative import. */
  maxParentImportDepth: 2,
});
