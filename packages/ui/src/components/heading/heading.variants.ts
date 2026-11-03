export const HEADING_LEVELS = [1, 2, 3] as const;

export type HeadingLevel = (typeof HEADING_LEVELS)[number];

export const HEADING_BASE_CLASSES = "font-bold text-foreground dark:text-foreground-dark";

export const HEADING_LEVEL_CLASSES: Readonly<Record<HeadingLevel, string>> = {
  1: "text-3xl",
  2: "text-2xl",
  3: "text-xl font-semibold",
};
