import type { ProductSummary } from "@repo/api";
import { Button, Notice, QuantityStepper, Text } from "@repo/ui";
import { Link } from "expo-router";
import { useState } from "react";
import { View } from "react-native";

import { FormError } from "../../components/form-error";
import { getApiErrorMessage } from "../../lib/error-message";
import { formatUnits } from "../../lib/format";
import { signInHref } from "../../lib/safe-redirect";
import { useAuthState } from "../auth";
import { addToOrderState } from "./cart-limits";
import { useAddItem, useDraft } from "./use-draft";

type AddToOrderPanelProps = Readonly<{ product: ProductSummary }>;

function AddForm({
  product,
  max,
  inDraft,
}: Readonly<{ product: ProductSummary; max: number; inDraft: number }>) {
  const [quantity, setQuantity] = useState(1);
  const addItem = useAddItem();
  const added = addItem.data?.lines.find((line) => line.productId === product.id);

  return (
    <View className="gap-4">
      <Text variant="label">Cantidad</Text>
      <QuantityStepper
        value={Math.min(quantity, max)}
        onChange={(value) => {
          setQuantity(value);
          addItem.reset();
        }}
        max={max}
        itemLabel={product.commercialName}
        testID="add-quantity"
      />
      <Text variant="muted" testID="add-max-hint">
        {inDraft > 0
          ? `Ya tienes ${formatUnits(inDraft)} en tu pedido. Puedes agregar hasta ${formatUnits(max)} más.`
          : `Puedes agregar hasta ${formatUnits(max)}.`}
      </Text>
      <FormError
        message={addItem.isError ? getApiErrorMessage(addItem.error) : null}
        testID="add-error"
      />
      {addItem.isSuccess && added !== undefined ? (
        <Notice tone="success" title="Producto agregado a tu pedido" testID="add-success">
          <Text>{`Tienes ${formatUnits(added.quantity)} de ${product.commercialName} en tu pedido.`}</Text>
          <Link href="/cart" asChild>
            <Button variant="outline" testID="add-go-to-cart">
              Ver mi pedido
            </Button>
          </Link>
        </Notice>
      ) : null}
      <Button
        loading={addItem.isPending}
        onPress={() => {
          addItem.mutate({ productId: product.id, quantity: Math.min(quantity, max) });
          setQuantity(1);
        }}
        testID="add-to-order"
      >
        Agregar al pedido
      </Button>
    </View>
  );
}

/** HU-03: choose a quantity (1..available) and add it to the draft order; needs a session. */
export function AddToOrderPanel({ product }: AddToOrderPanelProps) {
  const { isSignedIn } = useAuthState();
  const draft = useDraft(isSignedIn);
  const inDraft = draft.data?.lines.find((line) => line.productId === product.id)?.quantity ?? 0;
  const state = addToOrderState({ isSignedIn, availableQty: product.availableQty, inDraft });

  switch (state.kind) {
    case "out_of_stock": {
      return (
        <Notice tone="warning" title="Sin stock por ahora" testID="add-out-of-stock">
          <Text>
            No puedes agregar este producto a un pedido hasta que vuelva a estar disponible.
          </Text>
        </Notice>
      );
    }
    case "sign_in": {
      return (
        <Link href={signInHref(`/product/${product.id}`)} asChild>
          <Button testID="add-sign-in">Inicia sesión para agregarlo a tu pedido</Button>
        </Link>
      );
    }
    case "limit_reached": {
      return (
        <Notice tone="info" title="Ya tienes todas las unidades disponibles" testID="add-limit">
          <Text>{`Tu pedido tiene ${formatUnits(state.inDraft)} de este producto, el máximo disponible.`}</Text>
          <Link href="/cart" asChild>
            <Button variant="outline">Ver mi pedido</Button>
          </Link>
        </Notice>
      );
    }
    case "can_add": {
      if (draft.isPending) return null;
      return <AddForm product={product} max={state.max} inDraft={state.inDraft} />;
    }
  }
}
