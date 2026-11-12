import { Button, Notice, Text } from "@repo/ui";
import { useEffect, useRef, type ComponentRef } from "react";
import { AccessibilityInfo, Platform, View } from "react-native";

import { repeatNoticeView, type RepeatNotice } from "./repeat-notice";
import { useRepeatNotice } from "./use-orders";

type NoticeRef = ComponentRef<typeof View>;

/**
 * Moves the screen reader (and keyboard) focus to the notice when it appears: its live region
 * already has content on mount, so some screen readers would not announce it otherwise.
 */
function useFocusOnMount() {
  const ref = useRef<NoticeRef>(null);
  useEffect(() => {
    const node = ref.current;
    if (node === null) return;
    if (Platform.OS === "web") node.focus();
    else AccessibilityInfo.sendAccessibilityEvent(node, "focus");
  }, []);
  return ref;
}

type PanelProps = Readonly<{ notice: RepeatNotice; onDismiss: () => void }>;

function RepeatNoticePanel({ notice, onDismiss }: PanelProps) {
  const ref = useFocusOnMount();
  const view = repeatNoticeView(notice);
  return (
    <Notice ref={ref} tabIndex={-1} tone={view.tone} title={view.title} testID="cart-repeat-notice">
      {view.items.length > 0 ? (
        <View role="list" aria-label="Cambios al repetir el pedido" className="gap-1">
          {view.items.map((item) => (
            <View role="listitem" key={item.productId}>
              <Text testID="cart-repeat-change">{item.text}</Text>
            </View>
          ))}
        </View>
      ) : (
        <Text>Revisa las cantidades antes de continuar.</Text>
      )}
      <View className="flex-row">
        <Button variant="outline" onPress={onDismiss} testID="cart-repeat-dismiss">
          Entendido
        </Button>
      </View>
    </Notice>
  );
}

/**
 * Cart notice after "Repetir pedido" (HU-14, D-30): lists every product reduced or skipped, only
 * over the cart the changes were applied to (`draftId`). It is a live region and takes the focus.
 */
export function RepeatOrderNotice({ draftId }: Readonly<{ draftId: string | null }>) {
  const { notice, dismiss } = useRepeatNotice(draftId);
  if (notice === null) return null;
  return <RepeatNoticePanel notice={notice} onDismiss={dismiss} />;
}
