"use client";

import { Button, Text } from "@repo/ui";

import { QueryError } from "../../components/query-error";
import { isLoadingCurrentResults } from "../../lib/list-loading";
import { getTrpcErrorMessage } from "../../lib/trpc-errors";
import { auditResultText, type AuditFilters } from "./audit-filters";
import { AuditTable } from "./audit-table";
import { useAuditList } from "./use-audit-list";

/**
 * Audit entries for the filters in the URL, with "Cargar más" (admin only). The live region never
 * announces the previous filters' count while the new ones load.
 */
export function AuditList({ filters }: Readonly<{ filters: AuditFilters }>) {
  const query = useAuditList(filters);
  const entries = query.data?.pages.flatMap((page) => page.items) ?? [];
  const failed = query.isError && !query.isFetchNextPageError;
  const loading = isLoadingCurrentResults(query);

  return (
    <section aria-labelledby="audit-results-title" className="flex flex-col gap-4">
      <h2 id="audit-results-title" className="sr-only">
        Registros
      </h2>
      <Text role="status" variant="muted" aria-live="polite">
        {failed ? "" : auditResultText(loading, entries.length, filters)}
      </Text>
      {failed ? (
        <QueryError
          error={query.error}
          retrying={query.isRefetching}
          onRetry={() => {
            void query.refetch();
          }}
        />
      ) : null}
      {entries.length > 0 ? (
        <div aria-busy={query.isFetching} className={loading ? "opacity-60" : undefined}>
          <AuditTable entries={entries} />
        </div>
      ) : null}
      {query.isFetchNextPageError ? (
        <Text role="alert" className="text-destructive">
          {getTrpcErrorMessage(query.error)}
        </Text>
      ) : null}
      {query.hasNextPage ? (
        <Button
          variant="outline"
          className="self-center"
          loading={query.isFetchingNextPage}
          onPress={() => {
            void query.fetchNextPage();
          }}
        >
          Cargar más registros
        </Button>
      ) : null}
    </section>
  );
}
