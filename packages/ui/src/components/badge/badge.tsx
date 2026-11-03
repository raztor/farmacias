import type { ComponentProps } from "react";
import { Text as NativeText, View } from "react-native";

import { cn } from "../../lib/cn";
import { TONE_CLASSES, type Tone } from "../../lib/tones";
import { ToneIcon } from "../tone-icon/tone-icon";

export type BadgeProps = Omit<ComponentProps<typeof View>, "children"> & {
  /** Semantic tone: sets the border, text color and glyph. Defaults to `neutral`. */
  tone?: Tone;
  /** Visible text. Required: the badge never relies on color or icon alone. */
  children: string;
  className?: string;
};

/**
 * Small status label: icon + text (e.g. «Disponible», «Pago validado»). Read as a single text
 * by screen readers.
 */
export function Badge({ tone = "neutral", children, className, ...props }: BadgeProps) {
  const classes = TONE_CLASSES[tone];
  return (
    <View
      accessible
      accessibilityLabel={children}
      {...props}
      className={cn(
        "flex-row items-center gap-1.5 self-start rounded-full border bg-background px-2.5 py-1 dark:bg-background-dark",
        classes.border,
        className,
      )}
    >
      <ToneIcon tone={tone} />
      <NativeText className={cn("shrink text-sm font-semibold", classes.text)}>
        {children}
      </NativeText>
    </View>
  );
}
