import { Button, Text, useThemeColor } from "@repo/ui";
import { ActivityIndicator, View } from "react-native";

import { getApiErrorMessage } from "../lib/error-message";

export function LoadingState({ label = "Cargando…" }: Readonly<{ label?: string }>) {
  const color = useThemeColor("primary");
  return (
    <View className="items-center justify-center gap-2 py-8" accessibilityLabel={label}>
      <ActivityIndicator color={color} />
      <Text variant="muted">{label}</Text>
    </View>
  );
}

type ErrorStateProps = Readonly<{ error: unknown; onRetry: () => void }>;

export function ErrorState({ error, onRetry }: ErrorStateProps) {
  return (
    <View className="items-center gap-3 py-8">
      <Text role="alert" className="text-center">
        {getApiErrorMessage(error)}
      </Text>
      <Button variant="outline" size="sm" onPress={onRetry}>
        Reintentar
      </Button>
    </View>
  );
}
