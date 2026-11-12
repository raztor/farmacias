"use client";

import { Text } from "@repo/ui";

import { QueryError } from "../../components/query-error";
import { isLoadingCurrentResults } from "../../lib/list-loading";
import { isRetryableError } from "../../lib/trpc-errors";
import { DispensedReport } from "./dispensed-report";
import { LowStockReport } from "./low-stock-report";
import { OrdersByStatusReport } from "./orders-by-status-report";
import type { ReportsFilters } from "./reports-filters";
import { rangeLabel } from "./reports-format";
import { useReportsSummary } from "./use-reports-summary";

/**
 * The three operational reports of HU-13 for the range in the URL. Only aggregated figures: no
 * resident data (R-REP-07). The live region never announces the previous range while loading.
 */
export function ReportsOverview({ filters }: Readonly<{ filters: ReportsFilters }>) {
  const query = useReportsSummary(filters);
  const loading = isLoadingCurrentResults(query);
  const failed = query.isError;

  return (
    <div className="flex flex-col gap-8">
      <Text role="status" variant="muted" aria-live="polite">
        {failed ? "" : loading || !query.data ? "Cargando reportes…" : rangeLabel(query.data.range)}
      </Text>
      {failed ? (
        <QueryError
          error={query.error}
          retrying={query.isRefetching}
          canRetry={isRetryableError(query.error)}
          onRetry={() => {
            void query.refetch();
          }}
        />
      ) : null}
      {query.data && !failed ? (
        <div
          aria-busy={query.isFetching}
          className={loading ? "flex flex-col gap-10 opacity-60" : "flex flex-col gap-10"}
        >
          <DispensedReport report={query.data.dispensed} />
          <OrdersByStatusReport report={query.data.ordersByStatus} />
          <LowStockReport lowStock={query.data.lowStock} />
        </div>
      ) : null}
    </div>
  );
}
