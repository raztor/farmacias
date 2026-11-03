/** Builds a type guard for a closed list of string literals (values from untyped sources). */
export const createOneOfGuard =
  <const T extends string>(values: readonly T[]) =>
  (value: unknown): value is T =>
    typeof value === "string" && (values as readonly string[]).includes(value);
