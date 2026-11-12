"use client";

import { Badge } from "@repo/ui";

import { productStatusLabel } from "./catalog-format";

/** «Activo» / «Inactivo» pill: text plus icon, color only reinforces it (RNF-01). */
export function ProductStatusBadge({ active }: Readonly<{ active: boolean }>) {
  return <Badge tone={active ? "success" : "neutral"}>{productStatusLabel(active)}</Badge>;
}
