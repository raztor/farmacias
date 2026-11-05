import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import { createSessionCacheGuard, sessionUserId } from "./session-cache";

const DRAFT_KEY = [["orders", "draft"], { type: "query" }];
const MINE_KEY = [["orders", "mine"], { type: "infinite" }];
const DRAFT_OF_A = { code: "P-000001", itemCount: 4 };

function cachedClient() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(DRAFT_KEY, DRAFT_OF_A);
  client.setQueryData(MINE_KEY, { pages: [{ items: [{ code: "P-000001" }] }] });
  return client;
}

const session = (id: string | null, isPending = false) => ({
  isPending,
  data: id === null ? null : { user: { id }, session: { id: `s-${id}` } },
  error: null,
});

describe("sessionUserId", () => {
  it("reads the user id, null when signed out and undefined while unknown", () => {
    expect(sessionUserId(session("user-a"))).toBe("user-a");
    expect(sessionUserId(session(null))).toBeNull();
    expect(sessionUserId(session(null, true))).toBeUndefined();
    expect(sessionUserId({ unexpected: true })).toBeUndefined();
  });
});

describe("createSessionCacheGuard (HU-09 #2 on a shared device)", () => {
  it("drops the previous resident's cart and orders when the session expires", () => {
    const client = cachedClient();
    const guard = createSessionCacheGuard(client);

    guard("user-a");
    guard(null);

    expect(client.getQueryData(DRAFT_KEY)).toBeUndefined();
    expect(client.getQueryData(MINE_KEY)).toBeUndefined();
  });

  it("drops them when another resident takes over without a sign-out in between", () => {
    const client = cachedClient();
    const guard = createSessionCacheGuard(client);

    guard("user-a");
    guard("user-b");

    expect(client.getQueryData(DRAFT_KEY)).toBeUndefined();
  });

  it("also clears a mounted but disabled observer (the cart badge in the nav bar)", () => {
    const client = cachedClient();
    const badge = new QueryObserver(client, { queryKey: DRAFT_KEY, enabled: false });
    const unsubscribe = badge.subscribe(() => undefined);
    const guard = createSessionCacheGuard(client);
    expect(badge.getCurrentResult().data).toEqual(DRAFT_OF_A);

    guard("user-a");
    guard(null);

    expect(badge.getCurrentResult().data).toBeUndefined();
    unsubscribe();
  });

  it("keeps the cache for the first known user, the same user and an unknown state", () => {
    const client = cachedClient();
    const guard = createSessionCacheGuard(client);

    guard(undefined);
    guard("user-a");
    guard(undefined);
    guard("user-a");

    expect(client.getQueryData(DRAFT_KEY)).toEqual(DRAFT_OF_A);
  });
});
