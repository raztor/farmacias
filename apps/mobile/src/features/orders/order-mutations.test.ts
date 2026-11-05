import type { AppRouter } from "@repo/api";
import { MutationObserver, QueryClient } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import superjson from "superjson";
import { describe, expect, it } from "vitest";

import { cancelOrderOptions } from "./order-mutations";

const HTTP_CONFLICT = 409;
const STALE_VERSION_MESSAGE =
  "Este pedido cambió mientras lo revisabas. Recarga para ver su estado actual.";

/** tRPC client whose every call answers CONFLICT STALE_VERSION, as the API does. */
function conflictingClient() {
  const body = [
    {
      error: superjson.serialize({
        message: STALE_VERSION_MESSAGE,
        code: -32_009,
        data: { code: "CONFLICT", httpStatus: HTTP_CONFLICT, reason: "STALE_VERSION" },
      }),
    },
  ];
  return createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        url: "http://api.test/trpc",
        transformer: superjson,
        fetch: () =>
          Promise.resolve(
            new Response(JSON.stringify(body), {
              status: HTTP_CONFLICT,
              headers: { "content-type": "application/json" },
            }),
          ),
      }),
    ],
  });
}

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const trpc = createTRPCOptionsProxy<AppRouter>({ client: conflictingClient(), queryClient });
  const reported: unknown[] = [];
  const observer = new MutationObserver(
    queryClient,
    cancelOrderOptions({
      trpc,
      queryClient,
      onError: (error) => {
        reported.push(error);
      },
    }),
  );
  return { queryClient, trpc, observer, reported };
}

describe("cancelOrderOptions", () => {
  it("refreshes the cached order after a CONFLICT so a retry sends the current version", async () => {
    const { queryClient, trpc, observer, reported } = setup();
    // Untagged copy of the real key: the cached value's shape does not matter here.
    const detailKey = [...trpc.orders.detail.queryKey({ id: "order-1" })];
    queryClient.setQueryData(detailKey, { version: 3 });

    await expect(observer.mutate({ id: "order-1", expectedVersion: 3 })).rejects.toThrow(
      STALE_VERSION_MESSAGE,
    );

    expect(reported).toHaveLength(1);
    expect(queryClient.getQueryState(detailKey)?.isInvalidated).toBe(true);
    queryClient.clear();
  });

  it("also refreshes the catalog (stock may have changed)", async () => {
    const { queryClient, trpc, observer } = setup();
    const searchKey = trpc.catalog.pathKey();
    queryClient.setQueryData([...searchKey, "probe"], { items: [] });

    await expect(observer.mutate({ id: "order-1", expectedVersion: 3 })).rejects.toThrow();

    expect(queryClient.getQueryState([...searchKey, "probe"])?.isInvalidated).toBe(true);
    queryClient.clear();
  });
});
