import type { ReactNode } from "react";
import { Text as NativeText } from "react-native";

type ButtonLabelProps = Readonly<{ className: string; children: ReactNode }>;

/** Wraps plain text children in a styled `Text`; other nodes (icons, layouts) render as-is. */
export function ButtonLabel({ className, children }: ButtonLabelProps) {
  if (typeof children === "string" || typeof children === "number") {
    return <NativeText className={className}>{children}</NativeText>;
  }
  return children;
}
