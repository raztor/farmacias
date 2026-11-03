export const INPUT_BASE_CLASSES =
  "h-11 rounded-md border bg-background px-3 text-base text-foreground dark:bg-background-dark dark:text-foreground-dark web:focus-visible:outline-none";

export const INPUT_STATE_CLASSES = {
  default: "border-input focus:border-ring dark:border-input-dark dark:focus:border-ring-dark",
  error: "border-destructive dark:border-destructive-dark",
} as const;

export const INPUT_MESSAGE_CLASSES = {
  hint: "text-muted-foreground dark:text-muted-foreground-dark",
  error: "text-destructive dark:text-destructive-dark",
} as const;
