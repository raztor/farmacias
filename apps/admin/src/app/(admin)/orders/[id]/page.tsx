import type { Metadata } from "next";

import { OrderDetail, getAdminAccess } from "../../_deps";

export const metadata: Metadata = { title: "Detalle de pedido" };

type OrderPageProps = Readonly<{ params: Promise<{ id: string }> }>;

/** Order detail and physical progress (HU-08). `operations.*` enforce the role again. */
export default async function OrderPage({ params }: OrderPageProps) {
  // Same (cached) check as the `(admin)` layout, which renders the redirect or the 403 page.
  const access = await getAdminAccess();
  if (access.status !== "granted") return null;
  const { id } = await params;

  return <OrderDetail orderId={id} />;
}
