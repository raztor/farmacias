import type { Metadata } from "next";

import {
  OrdersQueue,
  PageHeader,
  QueueFiltersForm,
  getAdminAccess,
  parseQueueFilters,
  queueSearch,
  type SearchParamsRecord,
} from "./_deps";

export const metadata: Metadata = { title: "Bandeja de pedidos" };

type QueuePageProps = Readonly<{ searchParams: Promise<SearchParamsRecord> }>;

/**
 * Back-office home: the order queue (HU-07). Filters live in the URL; the `(admin)` layout has
 * already let in only operators and admins, and `operations.queue` enforces it again.
 */
export default async function QueuePage({ searchParams }: QueuePageProps) {
  // Same (cached) check as the `(admin)` layout, which renders the redirect or the 403 page.
  const access = await getAdminAccess();
  if (access.status !== "granted") return null;
  const parsed = parseQueueFilters(await searchParams);

  return (
    <>
      <PageHeader
        title="Bandeja de pedidos"
        description="Del más antiguo al más reciente: el primero en llegar es el primero en prepararse."
      />
      {/* Keyed by the URL so the form shows the applied filters after each navigation. */}
      <QueueFiltersForm
        key={`${queueSearch(parsed.filters)}|${parsed.codeInput}`}
        parsed={parsed}
      />
      <OrdersQueue filters={parsed.filters} />
    </>
  );
}
