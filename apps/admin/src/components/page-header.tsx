"use client";

import { Heading, Text } from "@repo/ui";

type PageHeaderProps = Readonly<{ title: string; description: string }>;

/**
 * Page title + subtitle. A client component because `@repo/ui` (NativeWind) components only
 * apply their classes when rendered from client components.
 */
export function PageHeader({ title, description }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-1">
      <Heading level={1}>{title}</Heading>
      <Text variant="muted">{description}</Text>
    </div>
  );
}
