"use client";

import { Card, CardContent, CardDescription, CardHeader, Text } from "@repo/ui";

import { formatStatValue } from "./format-stat";

type StatCardProps = Readonly<{
  label: string;
  description: string;
  /** `undefined` while loading. */
  value: number | undefined;
}>;

/** Single KPI: label, big number and a short explanation. */
export function StatCard({ label, description, value }: StatCardProps) {
  return (
    <Card className="flex-1">
      <CardHeader className="pb-2">
        <Text variant="label" className="text-muted-foreground">
          {label}
        </Text>
        <Text
          aria-busy={value === undefined}
          className="text-4xl font-bold text-foreground dark:text-foreground-dark"
        >
          {formatStatValue(value)}
        </Text>
      </CardHeader>
      <CardContent>
        <CardDescription>{description}</CardDescription>
      </CardContent>
    </Card>
  );
}
