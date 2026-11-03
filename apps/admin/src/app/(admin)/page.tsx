import type { Metadata } from "next";

import { PageHeader, StatsOverview } from "./_deps";

export const metadata: Metadata = { title: "Panel" };

export default function DashboardPage() {
  return (
    <>
      <PageHeader title="Panel" description="Resumen de la actividad de la plataforma." />
      <StatsOverview />
    </>
  );
}
