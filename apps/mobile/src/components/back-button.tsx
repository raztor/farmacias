import { Button } from "@repo/ui";
import { useRouter } from "expo-router";
import { View } from "react-native";

/** In-screen back navigation for stacks without a native header. */
export function BackButton({ label = "Volver" }: Readonly<{ label?: string }>) {
  const router = useRouter();
  if (!router.canGoBack()) return null;

  return (
    <View className="items-start">
      <Button
        variant="ghost"
        size="sm"
        onPress={() => {
          router.back();
        }}
        accessibilityLabel={label}
      >
        {`‹ ${label}`}
      </Button>
    </View>
  );
}
