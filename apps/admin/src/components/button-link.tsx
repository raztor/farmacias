import { cn } from "@repo/ui";
import Link from "next/link";
import type { ReactNode } from "react";

export type ButtonLinkVariant = "primary" | "outline" | "ghost";

const BASE_CLASSES =
  "inline-flex h-11 items-center justify-center rounded-md px-4 text-base font-semibold transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const VARIANT_CLASSES: Readonly<Record<ButtonLinkVariant, string>> = {
  primary: "bg-primary text-primary-foreground hover:opacity-90",
  outline: "border border-input bg-background text-foreground hover:bg-accent",
  ghost: "text-primary underline-offset-4 hover:underline",
};

/** Classes of a link or native `<button>` that looks like `@repo/ui`'s `Button`. */
export function buttonClasses(variant: ButtonLinkVariant = "primary", className?: string): string {
  return cn(BASE_CLASSES, VARIANT_CLASSES[variant], className);
}

type ButtonLinkProps = Readonly<{
  href: string;
  variant?: ButtonLinkVariant;
  className?: string;
  children: ReactNode;
}>;

/** Client-side navigation link (`<a>`) styled like `@repo/ui`'s `Button`. */
export function ButtonLink({ href, variant = "primary", className, children }: ButtonLinkProps) {
  return (
    <Link href={href} className={buttonClasses(variant, className)}>
      {children}
    </Link>
  );
}
