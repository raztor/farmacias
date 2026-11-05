import type { ComponentProps, ReactNode } from "react";
import { Text as NativeText, View } from "react-native";

import { cn } from "../../lib/cn";
import { TONE_CLASSES, type Tone } from "../../lib/tones";
import { ToneIcon } from "../tone-icon/tone-icon";

export type NoticeProps = ComponentProps<typeof View> & {
  /** Semantic tone (border, icon). Defaults to `info`. */
  tone?: Tone;
  /** Short summary of what happened, e.g. «Pago rechazado». */
  title: string;
  /**
   * `alert` interrupts screen readers (errors, results the person must act on); `status` is
   * announced politely. Defaults to `status`.
   */
  announce?: "alert" | "status";
  /** Explanation and next steps (text, buttons). */
  children?: ReactNode;
  className?: string;
};

/**
 * Message panel with an icon, a title and the next steps (RNF-09: say what happened and how to
 * continue). The tone is conveyed by the icon glyph and the title, not only by color.
 */
export function Notice({
  tone = "info",
  title,
  announce = "status",
  children,
  className,
  ...props
}: NoticeProps) {
  const classes = TONE_CLASSES[tone];
  return (
    <View
      role={announce}
      accessibilityLiveRegion={announce === "alert" ? "assertive" : "polite"}
      aria-live={announce === "alert" ? "assertive" : "polite"}
      {...props}
      className={cn(
        "gap-3 rounded-lg border bg-card p-4 dark:bg-card-dark",
        classes.border,
        className,
      )}
    >
      <View className="flex-row items-start gap-3">
        <ToneIcon tone={tone} size="md" />
        <NativeText
          role="heading"
          className="flex-1 text-lg font-semibold text-card-foreground dark:text-card-foreground-dark"
        >
          {title}
        </NativeText>
      </View>
      {children === undefined ? null : <View className="gap-3">{children}</View>}
    </View>
  );
}
