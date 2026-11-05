"use client";

import { Heading, Text } from "@repo/ui";
import type { ReactNode } from "react";

type StatusScreenProps = Readonly<{
  /** Short status label (e.g. "404"). */
  eyebrow?: string;
  title: string;
  description: string;
  /** Action buttons or links. */
  children?: ReactNode;
}>;

/** Full-page message for not-found and error states. */
export function StatusScreen({ eyebrow, title, description, children }: StatusScreenProps) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      {eyebrow === undefined ? null : (
        <Text variant="label" className="text-primary">
          {eyebrow}
        </Text>
      )}
      <Heading level={1} className="text-center">
        {title}
      </Heading>
      <Text variant="muted" className="max-w-md text-center text-base">
        {description}
      </Text>
      <div className="mt-2 flex flex-row flex-wrap justify-center gap-3">{children}</div>
    </main>
  );
}
