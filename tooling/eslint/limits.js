/**
 * Límites de tamaño y complejidad del repositorio.
 * Fuente única: docs/REPO_RULES.md los documenta y ESLint los aplica como `error`.
 * Cambiarlos requiere un ADR (docs/adr).
 */
export const LIMITS = Object.freeze({
  /** Líneas por archivo (sin contar líneas en blanco ni comentarios). */
  maxLinesPerFile: 300,
  /** Líneas por función o componente. */
  maxLinesPerFunction: 60,
  /** Complejidad ciclomática por función. */
  complexity: 12,
  /** Bloques anidados (if/for/while/try) por función. */
  maxDepth: 4,
  /** Parámetros por función (usar un objeto si se necesitan más). */
  maxParams: 4,
  /** Callbacks anidados. */
  maxNestedCallbacks: 3,
  /** Niveles de `../` permitidos en un import relativo. */
  maxParentImportDepth: 2,
});
