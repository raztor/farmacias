"use client";

import { Text } from "@repo/ui";

type FormAlertProps = Readonly<{ message: string | null }>;

/** Form-level error announced to screen readers when it appears. */
export function FormAlert({ message }: FormAlertProps) {
  if (message === null) return null;
  return (
    <Text
      role="alert"
      aria-live="assertive"
      className="rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive"
    >
      {message}
    </Text>
  );
}
