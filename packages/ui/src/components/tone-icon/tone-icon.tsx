import { Text as NativeText, View } from "react-native";

import { cn } from "../../lib/cn";
import { TONE_CLASSES, TONE_GLYPHS, type Tone } from "../../lib/tones";

export type ToneIconProps = Readonly<{
  tone: Tone;
  /** `sm` for inline badges, `md` for notices and timelines. Defaults to `sm`. */
  size?: "sm" | "md";
  className?: string;
}>;

const SIZE_CLASSES = {
  sm: { circle: "h-4 w-4", glyph: "text-[10px] leading-[16px]" },
  md: { circle: "h-6 w-6", glyph: "text-xs leading-[24px]" },
} as const;

/**
 * Round icon with a glyph per tone (✓, !, ✕…), so a state is never conveyed by color only.
 * Decorative: always paired with a text label, hence hidden from assistive technologies.
 */
export function ToneIcon({ tone, size = "sm", className }: ToneIconProps) {
  const classes = TONE_CLASSES[tone];
  const sizeClasses = SIZE_CLASSES[size];
  return (
    <View
      aria-hidden
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className={cn(
        "items-center justify-center rounded-full",
        sizeClasses.circle,
        classes.solid,
        className,
      )}
    >
      <NativeText
        allowFontScaling={false}
        className={cn("text-center font-bold", sizeClasses.glyph, classes.onSolid)}
      >
        {TONE_GLYPHS[tone]}
      </NativeText>
    </View>
  );
}
