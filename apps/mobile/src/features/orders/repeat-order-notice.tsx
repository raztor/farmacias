import { Button, Notice, Text } from "@repo/ui";
import { View } from "react-native";

import { repeatNoticeView } from "./repeat-notice";
import { useRepeatNotice } from "./use-orders";

/**
 * Cart notice after "Repetir pedido" (HU-14, D-30): lists every product reduced or skipped.
 * `Notice` is a live region, so screen readers announce it when the cart opens.
 */
export function RepeatOrderNotice() {
  const { notice, dismiss } = useRepeatNotice();
  if (notice === null) return null;
  const view = repeatNoticeView(notice);
  return (
    <Notice tone={view.tone} title={view.title} testID="cart-repeat-notice">
      {view.items.length > 0 ? (
        <View role="list" aria-label="Cambios al repetir el pedido" className="gap-1">
          {view.items.map((item) => (
            <View role="listitem" key={item}>
              <Text testID="cart-repeat-change">{item}</Text>
            </View>
          ))}
        </View>
      ) : (
        <Text>Revisa las cantidades antes de continuar.</Text>
      )}
      <View className="flex-row">
        <Button variant="outline" onPress={dismiss} testID="cart-repeat-dismiss">
          Entendido
        </Button>
      </View>
    </Notice>
  );
}
