"use client";

import type { Role } from "@repo/shared";
import { cn } from "@repo/ui";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { isNavItemActive, navItemsFor } from "../lib/nav-items";

type AdminNavProps = Readonly<{ role: Role }>;

/**
 * Primary navigation of the backoffice, filtered by role; marks the current section with
 * `aria-current`.
 */
export function AdminNav({ role }: AdminNavProps) {
  const pathname = usePathname();

  return (
    <nav aria-label="Navegación principal">
      {/* Wraps on narrow windows and at 200 % zoom (SC 1.4.10): never a horizontal scroll. */}
      <ul className="flex flex-row flex-wrap gap-1">
        {navItemsFor(role).map((item) => {
          const active = isNavItemActive(item, pathname);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-11 items-center rounded-md px-3 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active
                    ? "bg-accent text-foreground underline underline-offset-4"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
