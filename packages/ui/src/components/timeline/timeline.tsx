import { Text as NativeText, View } from "react-native";

import { cn } from "../../lib/cn";
import type { Tone } from "../../lib/tones";
import { ToneIcon } from "../tone-icon/tone-icon";

export type TimelineItem = Readonly<{
  /** Stable key (e.g. index + status). */
  key: string;
  /** Milestone name, e.g. «Pago validado». */
  title: string;
  /** Secondary line, e.g. «Sistema · 3 nov 2026, 10:42». */
  meta: string;
  /** Optional free text (e.g. a note from the pharmacy). */
  note?: string | null;
  tone?: Tone;
  /** Marks the current milestone (announced and drawn in bold). */
  current?: boolean;
}>;

export type TimelineProps = Readonly<{
  items: readonly TimelineItem[];
  /** Accessible name of the list, e.g. «Historial del pedido». */
  label: string;
  className?: string;
  testID?: string;
}>;

function TimelineRow({ item, isLast }: Readonly<{ item: TimelineItem; isLast: boolean }>) {
  return (
    <View role="listitem" className="flex-row gap-3">
      <View className="items-center">
        <ToneIcon tone={item.tone ?? "neutral"} size="md" />
        {isLast ? null : <View className="w-0.5 flex-1 bg-border dark:bg-border-dark" />}
      </View>
      <View className={cn("flex-1 gap-0.5", isLast ? "pb-0" : "pb-5")}>
        <NativeText
          className={cn(
            "text-base text-foreground dark:text-foreground-dark",
            item.current === true ? "font-bold" : "font-medium",
          )}
        >
          {item.current === true ? `${item.title} (estado actual)` : item.title}
        </NativeText>
        <NativeText className="text-sm text-muted-foreground dark:text-muted-foreground-dark">
          {item.meta}
        </NativeText>
        {item.note === undefined || item.note === null ? null : (
          <NativeText className="text-sm italic text-foreground dark:text-foreground-dark">
            {`Nota: ${item.note}`}
          </NativeText>
        )}
      </View>
    </View>
  );
}

/** Vertical, chronological list of milestones (oldest first). */
export function Timeline({ items, label, className, testID }: TimelineProps) {
  return (
    <View
      role="list"
      aria-label={label}
      accessibilityLabel={label}
      testID={testID}
      className={cn("gap-0", className)}
    >
      {items.map((item, index) => (
        <TimelineRow key={item.key} item={item} isLast={index === items.length - 1} />
      ))}
    </View>
  );
}
