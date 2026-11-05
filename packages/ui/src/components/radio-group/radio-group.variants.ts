export const RADIO_OPTION_VARIANTS = ["card", "chip"] as const;

export type RadioOptionVariant = (typeof RADIO_OPTION_VARIANTS)[number];

type RadioOptionClasses = Readonly<{
  container: string;
  idle: string;
  selected: string;
  label: string;
  selectedLabel: string;
}>;

export const RADIO_OPTION_CLASSES: Readonly<Record<RadioOptionVariant, RadioOptionClasses>> = {
  card: {
    container: "min-h-11 flex-row items-start gap-3 rounded-lg border p-4",
    idle: "border-input bg-background dark:border-input-dark dark:bg-background-dark",
    selected: "border-2 border-primary bg-accent dark:border-primary-dark dark:bg-accent-dark",
    label: "text-base font-medium text-foreground dark:text-foreground-dark",
    selectedLabel: "font-semibold",
  },
  chip: {
    container: "min-h-11 items-center justify-center rounded-full border px-4 py-2",
    idle: "border-input bg-background dark:border-input-dark dark:bg-background-dark",
    selected: "border-primary bg-primary dark:border-primary-dark dark:bg-primary-dark",
    label: "text-sm font-medium text-foreground dark:text-foreground-dark",
    selectedLabel: "font-semibold text-primary-foreground dark:text-primary-foreground-dark",
  },
};
