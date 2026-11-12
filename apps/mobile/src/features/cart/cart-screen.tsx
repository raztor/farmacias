import type { OrderDraft } from "@repo/api";
import { Button, Heading, Notice, Text } from "@repo/ui";
import { Link } from "expo-router";
import { View } from "react-native";

import { AppScreen } from "../../components/app-screen";
import { ErrorState, LoadingState } from "../../components/query-state";
import { formatClp, formatUnits } from "../../lib/format";
import { RequireSignIn } from "../auth";
import { RepeatOrderNotice } from "../orders";
import { CartLine } from "./cart-line";
import { useDraft } from "./use-draft";

function EmptyCart() {
  return (
    <Notice tone="info" title="Tu pedido está vacío" testID="cart-empty">
      <Text>Busca un medicamento en el catálogo y agrégalo para comenzar tu pedido.</Text>
      <Link href="/" asChild>
        <Button variant="outline">Ir al catálogo</Button>
      </Link>
    </Notice>
  );
}

function CartContent({ draft }: Readonly<{ draft: OrderDraft }>) {
  return (
    <View className="gap-4">
      <View role="list" aria-label="Productos de tu pedido" className="gap-3">
        {draft.lines.map((line) => (
          <View role="listitem" key={line.productId}>
            <CartLine line={line} />
          </View>
        ))}
      </View>
      <View className="gap-1 rounded-lg bg-muted p-4 dark:bg-muted-dark">
        <Text variant="muted">{`${formatUnits(draft.itemCount)} en total`}</Text>
        <Text className="text-xl font-bold" testID="cart-total">
          {`Total: ${formatClp(draft.totalClp)}`}
        </Text>
      </View>
      <Link href="/checkout" asChild>
        <Button size="lg" testID="cart-checkout">
          Continuar: elegir retiro o despacho
        </Button>
      </Link>
    </View>
  );
}

function CartBody() {
  const draft = useDraft();
  if (draft.isPending) return <LoadingState />;
  if (draft.isError) {
    return (
      <ErrorState
        error={draft.error}
        onRetry={() => {
          void draft.refetch();
        }}
      />
    );
  }
  if (draft.data === null || draft.data.lines.length === 0) return <EmptyCart />;
  return <CartContent draft={draft.data} />;
}

/** «Mi pedido» (HU-03): the draft order with quantities, subtotals and total. */
export function CartScreen() {
  return (
    <AppScreen>
      <View className="gap-2">
        <Heading testID="cart-title">Mi pedido</Heading>
        <Text variant="muted">
          Revisa los productos y cantidades. El stock se descuenta recién cuando el pago se aprueba.
        </Text>
      </View>
      <RequireSignIn title="Inicia sesión para ver tu pedido">
        <View className="gap-4">
          <RepeatOrderNotice />
          <CartBody />
        </View>
      </RequireSignIn>
    </AppScreen>
  );
}
