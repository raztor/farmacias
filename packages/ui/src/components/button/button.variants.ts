import type { SemanticColor } from "@repo/tailwind-config";

export const BUTTON_VARIANTS = ["primary", "secondary", "outline", "ghost", "destructive"] as const;

export type ButtonVariant = (typeof BUTTON_VARIANTS)[number];

export const BUTTON_SIZES = ["sm", "md", "lg"] as const;

export type ButtonSize = (typeof BUTTON_SIZES)[number];

type VariantStyle = Readonly<{
  container: string;
  label: string;
  /** Token for the loading spinner, which takes a raw color instead of a class. */
  spinner: SemanticColor;
}>;

type SizeStyle = Readonly<{ container: string; label: string }>;

export const BUTTON_BASE_CLASSES =
  "flex-row items-center justify-center web:focus-visible:outline-none web:focus-visible:ring-2 web:focus-visible:ring-ring dark:web:focus-visible:ring-ring-dark";

export const BUTTON_LABEL_BASE_CLASSES = "text-center font-semibold";

export const BUTTON_VARIANT_STYLES: Readonly<Record<ButtonVariant, VariantStyle>> = {
  primary: {
    container: "bg-primary active:opacity-90 dark:bg-primary-dark",
    label: "text-primary-foreground dark:text-primary-foreground-dark",
    spinner: "primary-foreground",
  },
  secondary: {
    container: "bg-secondary active:opacity-80 dark:bg-secondary-dark",
    label: "text-secondary-foreground dark:text-secondary-foreground-dark",
    spinner: "secondary-foreground",
  },
  outline: {
    container:
      "border border-input bg-background active:bg-accent dark:border-input-dark dark:bg-background-dark dark:active:bg-accent-dark",
    label: "text-foreground dark:text-foreground-dark",
    spinner: "foreground",
  },
  ghost: {
    container: "bg-transparent active:bg-accent dark:active:bg-accent-dark",
    label: "text-foreground dark:text-foreground-dark",
    spinner: "foreground",
  },
  destructive: {
    container: "bg-destructive active:opacity-90 dark:bg-destructive-dark",
    label: "text-destructive-foreground dark:text-destructive-foreground-dark",
    spinner: "destructive-foreground",
  },
};

export const BUTTON_SIZE_STYLES: Readonly<Record<ButtonSize, SizeStyle>> = {
  sm: { container: "min-h-9 gap-1.5 rounded-md px-3 py-1.5", label: "text-sm" },
  md: { container: "min-h-11 gap-2 rounded-md px-4 py-2", label: "text-base" },
  lg: { container: "min-h-12 gap-2 rounded-lg px-6 py-2.5", label: "text-lg" },
};
