import { Text as NativeText } from "react-native";

import { cn } from "../../lib/cn";
import { INPUT_MESSAGE_CLASSES } from "./input.variants";

type InputMessageProps = Readonly<{ nativeID: string; isError: boolean; children: string }>;

/** Hint or error under an input. Errors are announced by screen readers when they appear. */
export function InputMessage({ nativeID, isError, children }: InputMessageProps) {
  return (
    <NativeText
      nativeID={nativeID}
      role={isError ? "alert" : undefined}
      accessibilityLiveRegion={isError ? "polite" : "none"}
      aria-live={isError ? "polite" : "off"}
      className={cn("text-sm", isError ? INPUT_MESSAGE_CLASSES.error : INPUT_MESSAGE_CLASSES.hint)}
    >
      {children}
    </NativeText>
  );
}
