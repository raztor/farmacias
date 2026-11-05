import { Button, Heading, Notice, Text } from "@repo/ui";
import { Link } from "expo-router";
import { View } from "react-native";

import { AppScreen } from "../../components/app-screen";
import { BackButton } from "../../components/back-button";
import { ErrorState, LoadingState } from "../../components/query-state";
import { RequireSignIn } from "../auth";
import { useDraft } from "../cart";
import { CheckoutForm } from "./checkout-form";
import { CheckoutSummary } from "./checkout-summary";

function CheckoutBody() {
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
  if (draft.data === null || draft.data.lines.length === 0) {
    return (
      <Notice tone="info" title="No tienes productos para confirmar" testID="checkout-empty">
        <Text>Agrega al menos un producto desde el catálogo para confirmar un pedido.</Text>
        <Link href="/" asChild>
          <Button variant="outline">Ir al catálogo</Button>
        </Link>
      </Notice>
    );
  }
  return (
    <View className="gap-6">
      <CheckoutSummary draft={draft.data} />
      <CheckoutForm draft={draft.data} />
    </View>
  );
}

/** «Confirmar pedido» (HU-04): summary, fulfillment and confirmation. */
export function CheckoutScreen() {
  return (
    <AppScreen>
      <BackButton label="Volver a mi pedido" />
      <View className="gap-2">
        <Heading testID="checkout-title">Confirmar pedido</Heading>
        <Text variant="muted">Elige cómo recibirlo. Después podrás simular el pago.</Text>
      </View>
      <RequireSignIn title="Inicia sesión para confirmar tu pedido">
        <CheckoutBody />
      </RequireSignIn>
    </AppScreen>
  );
}
