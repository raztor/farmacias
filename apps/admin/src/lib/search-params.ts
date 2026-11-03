/** `searchParams` of a Next.js page, once awaited. */
export type SearchParamsRecord = Readonly<Record<string, string | string[] | undefined>>;

/** Every value of a (possibly repeated) query parameter, trimmed, blanks removed. */
export function readAll(params: SearchParamsRecord, key: string): string[] {
  const value = params[key];
  const values = value === undefined ? [] : Array.isArray(value) ? value : [value];
  return values.map((item) => item.trim()).filter((item) => item !== "");
}

/** First non-blank value of a query parameter (trimmed), or `undefined`. */
export function readFirst(params: SearchParamsRecord, key: string): string | undefined {
  return readAll(params, key)[0];
}

/** One query parameter (key, value). */
export type SearchPair = readonly [key: string, value: string];

/** `?a=1&b=2` (or `""` when there is nothing to encode) from ordered key/value pairs. */
export function toSearch(entries: readonly SearchPair[]): string {
  if (entries.length === 0) return "";
  return `?${new URLSearchParams(entries.map(([key, value]) => [key, value])).toString()}`;
}

/**
 * Query string of a submitted GET form: blank fields dropped and values trimmed, so URLs stay
 * clean (`?status=a` instead of `?status=a&code=&fulfillment=`). Pure.
 */
export function compactSearch(entries: Iterable<readonly [string, FormDataEntryValue]>): string {
  const pairs: SearchPair[] = [];
  for (const [key, value] of entries) {
    if (typeof value === "string" && value.trim() !== "") pairs.push([key, value.trim()]);
  }
  return toSearch(pairs);
}
