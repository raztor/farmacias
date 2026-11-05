import type { ComponentProps } from "react";
import { Text as NativeText } from "react-native";

import { cn } from "../../lib/cn";
import { webAria } from "../../lib/web-aria";
import { HEADING_BASE_CLASSES, HEADING_LEVEL_CLASSES, type HeadingLevel } from "./heading.variants";

export type HeadingProps = ComponentProps<typeof NativeText> & {
  /** Semantic level (1–3). Rendered as `<h1>`–`<h3>` on the web. Defaults to 1. */
  level?: HeadingLevel;
  className?: string;
};

/** Section heading announced as a header by screen readers. */
export function Heading({ level = 1, className, ...props }: HeadingProps) {
  return (
    <NativeText
      accessibilityRole="header"
      {...webAria({ "aria-level": level })}
      {...props}
      className={cn(HEADING_BASE_CLASSES, HEADING_LEVEL_CLASSES[level], className)}
    />
  );
}
