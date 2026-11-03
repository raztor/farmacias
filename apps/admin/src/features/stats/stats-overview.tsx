"use client";

import { Button, Text } from "@repo/ui";

import { getTrpcErrorMessage } from "../../lib/trpc-errors";
import { StatCard } from "./stat-card";
import { useAdminStats, type AdminStats } from "./use-admin-stats";

type StatDefinition = Readonly<{ key: keyof AdminStats; label: string; description: string }>;

const STATS: readonly StatDefinition[] = [
  {
    key: "totalUsers",
    label: "Usuarios totales",
    description: "Cuentas registradas en la plataforma.",
  },
  {
    key: "newUsersLast7Days",
    label: "Nuevos (7 días)",
    description: "Cuentas creadas durante la última semana.",
  },
  {
    key: "activeSessions",
    label: "Sesiones activas",
    description: "Sesiones que aún no han expirado.",
  },
];

/** Dashboard KPI cards backed by `admin.stats`, with loading and retry states. */
export function StatsOverview() {
  const { data, error, isPending, isRefetching, refetch } = useAdminStats();

  return (
    <section aria-label="Indicadores" className="flex flex-col gap-4">
      {isPending ? (
        <Text role="status" variant="muted">
          Cargando indicadores…
        </Text>
      ) : null}
      {error === null ? null : (
        <div className="flex flex-col items-start gap-3">
          <Text role="alert" className="text-destructive">
            {getTrpcErrorMessage(error)}
          </Text>
          <Button
            variant="outline"
            size="sm"
            loading={isRefetching}
            onPress={() => {
              void refetch();
            }}
          >
            Reintentar
          </Button>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-3">
        {STATS.map((stat) => (
          <StatCard
            key={stat.key}
            label={stat.label}
            description={stat.description}
            value={data?.[stat.key]}
          />
        ))}
      </div>
    </section>
  );
}
