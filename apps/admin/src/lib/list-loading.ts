/** The parts of a TanStack (infinite) query result that tell whether its rows are current. */
export type ListQueryState = Readonly<{ isPending: boolean; isPlaceholderData: boolean }>;

/**
 * `true` while the rows for the current filters are not loaded yet: the first load, or while
 * `keepPreviousData` keeps showing the previous filters' rows as placeholder. Result counts must
 * not be announced in either case (they would describe other filters). Pure.
 */
export function isLoadingCurrentResults(query: ListQueryState): boolean {
  return query.isPending || query.isPlaceholderData;
}
