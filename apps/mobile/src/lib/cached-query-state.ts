/**
 * What a screen should render for a query. TanStack Query switches to `status: "error"` when a
 * background refetch fails even though it keeps the previous `data`; a screen that renders an
 * error for `isError` alone would unmount everything below it (and lose its local state, such as
 * the outcome of a payment). Data in hand always wins: the failure is reported as `stale`.
 */
export type CachedQueryState<TData> =
  | Readonly<{ kind: "loading" }>
  | Readonly<{ kind: "error"; error: unknown }>
  | Readonly<{ kind: "ready"; data: TData; stale: boolean }>;

type QueryLike<TData> = Readonly<{ data: TData | undefined; error: unknown; isError: boolean }>;

/** Pure: maps a query result (from `useQuery` or a `QueryObserver`) to what to render. */
export function cachedQueryState<TData>(query: QueryLike<TData>): CachedQueryState<TData> {
  if (query.data !== undefined) return { kind: "ready", data: query.data, stale: query.isError };
  if (query.isError) return { kind: "error", error: query.error };
  return { kind: "loading" };
}
