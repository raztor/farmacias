import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import { cachedQueryState } from "./cached-query-state";

type Order = Readonly<{ id: string; status: string }>;

const ORDER: Order = { id: "order-1", status: "pending_payment" };

describe("cachedQueryState", () => {
  it("is loading before the first answer and an error when nothing was ever loaded", () => {
    const failure = new Error("sin respuesta");

    expect(cachedQueryState({ data: undefined, error: null, isError: false })).toEqual({
      kind: "loading",
    });
    expect(cachedQueryState({ data: undefined, error: failure, isError: true })).toEqual({
      kind: "error",
      error: failure,
    });
  });

  it("keeps rendering the cached data when a background refetch fails (payment D-12)", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    let calls = 0;
    const observer = new QueryObserver<Order>(client, {
      queryKey: ["orders", "detail", ORDER.id],
      queryFn: () => {
        calls += 1;
        if (calls === 1) return Promise.resolve(ORDER);
        return Promise.reject(new TypeError("Failed to fetch"));
      },
    });
    const unsubscribe = observer.subscribe(() => undefined);

    await observer.refetch();
    const afterFailure = await observer.refetch();

    // TanStack keeps the data but reports the query as errored.
    expect(afterFailure.isError).toBe(true);
    expect(afterFailure.data).toEqual(ORDER);
    expect(cachedQueryState(afterFailure)).toEqual({ kind: "ready", data: ORDER, stale: true });
    unsubscribe();
    client.clear();
  });

  it("is ready and fresh after a successful answer", () => {
    expect(cachedQueryState({ data: ORDER, error: null, isError: false })).toEqual({
      kind: "ready",
      data: ORDER,
      stale: false,
    });
  });
});
