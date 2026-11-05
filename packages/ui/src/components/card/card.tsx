import type { ComponentProps } from "react";
import { View } from "react-native";

import { cn } from "../../lib/cn";
import { Heading, type HeadingProps } from "../heading/heading";
import { Text, type TextProps } from "../text/text";

export type CardProps = ComponentProps<typeof View> & { className?: string };

/** Surface that groups related content. Compose it with the `Card*` parts. */
export function Card({ className, ...props }: CardProps) {
  return (
    <View
      {...props}
      className={cn(
        "rounded-lg border border-border bg-card shadow-sm dark:border-border-dark dark:bg-card-dark",
        className,
      )}
    />
  );
}

export function CardHeader({ className, ...props }: CardProps) {
  return <View {...props} className={cn("gap-1.5 p-6", className)} />;
}

/** Card title. A level-3 heading by default. */
export function CardTitle({ level = 3, className, ...props }: HeadingProps) {
  return (
    <Heading
      {...props}
      level={level}
      className={cn("text-card-foreground dark:text-card-foreground-dark", className)}
    />
  );
}

export function CardDescription({ variant = "muted", ...props }: TextProps) {
  return <Text {...props} variant={variant} />;
}

export function CardContent({ className, ...props }: CardProps) {
  return <View {...props} className={cn("gap-4 px-6 pb-6", className)} />;
}

export function CardFooter({ className, ...props }: CardProps) {
  return <View {...props} className={cn("flex-row items-center gap-2 px-6 pb-6", className)} />;
}
