import { Text } from "@repo/ui";

type FormErrorProps = Readonly<{ message: string | null; testID?: string }>;

/** Form-level error (e.g. rejected credentials), announced by screen readers. */
export function FormError({ message, testID }: FormErrorProps) {
  if (message === null) return null;
  return (
    <Text
      role="alert"
      accessibilityLiveRegion="polite"
      testID={testID}
      className="text-sm text-destructive dark:text-destructive-dark"
    >
      {message}
    </Text>
  );
}
