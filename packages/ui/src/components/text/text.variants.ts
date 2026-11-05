export const TEXT_VARIANTS = ["body", "muted", "small", "label"] as const;

export type TextVariant = (typeof TEXT_VARIANTS)[number];

export const TEXT_VARIANT_CLASSES: Readonly<Record<TextVariant, string>> = {
  body: "text-base text-foreground dark:text-foreground-dark",
  muted: "text-sm text-muted-foreground dark:text-muted-foreground-dark",
  small: "text-xs text-foreground dark:text-foreground-dark",
  label: "text-sm font-medium text-foreground dark:text-foreground-dark",
};
