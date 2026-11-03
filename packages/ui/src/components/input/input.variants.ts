export const INPUT_BASE_CLASSES =
  "min-h-11 rounded-md border bg-background px-3 py-2 text-base text-foreground dark:bg-background-dark dark:text-foreground-dark web:focus-visible:outline-none web:focus-visible:ring-2 web:focus-visible:ring-ring dark:web:focus-visible:ring-ring-dark";

export const INPUT_STATE_CLASSES = {
  default: "border-input focus:border-ring dark:border-input-dark dark:focus:border-ring-dark",
  error: "border-destructive dark:border-destructive-dark",
} as const;

export const INPUT_MESSAGE_CLASSES = {
  hint: "text-muted-foreground dark:text-muted-foreground-dark",
  error: "text-destructive dark:text-destructive-dark",
} as const;
