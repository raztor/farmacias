import type { ComponentProps } from "react";
import { Text as NativeText } from "react-native";

import { cn } from "../../lib/cn";
import { TEXT_VARIANT_CLASSES, type TextVariant } from "./text.variants";

export type TextProps = ComponentProps<typeof NativeText> & {
  /** Typographic style. Defaults to `body`. */
  variant?: TextVariant;
  className?: string;
};

/** Themed text that follows the design system typography. */
export function Text({ variant = "body", className, ...props }: TextProps) {
  return <NativeText {...props} className={cn(TEXT_VARIANT_CLASSES[variant], className)} />;
}
