import type { ComponentProps } from "react";
import { ScrollView, View } from "react-native";

import { cn } from "../../lib/cn";

export type ScreenProps = ComponentProps<typeof View> & {
  /** Wraps the content in a `ScrollView`. Defaults to `false`. */
  scroll?: boolean;
  className?: string;
  /** Classes for the inner content container (padding and spacing). */
  contentClassName?: string;
};

const CONTENT_CLASSES = "gap-4 p-4";

/**
 * Full-screen container with the app background and safe-area padding.
 *
 * Safe-area insets come from NativeWind's `*-safe` utilities: `env(safe-area-inset-*)` on the
 * web and, on native, the insets of the app's `SafeAreaProvider` (provided by Expo Router).
 */
export function Screen({
  scroll = false,
  className,
  contentClassName,
  children,
  ...props
}: ScreenProps) {
  return (
    <View
      {...props}
      className={cn(
        "flex-1 bg-background pb-safe pt-safe px-safe dark:bg-background-dark",
        className,
      )}
    >
      {scroll ? (
        <ScrollView
          className="flex-1"
          contentContainerClassName={cn("grow", CONTENT_CLASSES, contentClassName)}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      ) : (
        <View className={cn("flex-1", CONTENT_CLASSES, contentClassName)}>{children}</View>
      )}
    </View>
  );
}
