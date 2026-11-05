import { Screen } from "@repo/ui";
import type { ReactNode } from "react";

type AppScreenProps = Readonly<{ children: ReactNode; testID?: string }>;

/**
 * Scrollable page of the resident app: readable width on large screens (no horizontal scroll
 * at 200 % zoom) and no bottom inset, which the navigation bar below already adds.
 */
export function AppScreen({ children, testID }: AppScreenProps) {
  return (
    <Screen
      scroll
      bottomInset={false}
      contentClassName="w-full max-w-3xl self-center gap-6"
      testID={testID}
    >
      {children}
    </Screen>
  );
}
