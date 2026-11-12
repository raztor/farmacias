import { can, type Role } from "@repo/shared";

export type NavItem = Readonly<{
  href: string;
  label: string;
  /** Roles that see the item (the API enforces the same rule on the page's procedures). */
  isVisibleFor: (role: Role) => boolean;
  /** Other path prefixes that belong to the section (e.g. an order detail is in the queue). */
  sectionPrefixes?: readonly string[];
}>;

/** Primary navigation of the back office, in display order. */
export const NAV_ITEMS: readonly NavItem[] = [
  {
    href: "/",
    label: "Bandeja",
    isVisibleFor: (role) => can(role, "operations", "read"),
    sectionPrefixes: ["/orders"],
  },
  {
    href: "/inventory",
    label: "Inventario",
    isVisibleFor: (role) => can(role, "inventory", "read"),
  },
  { href: "/catalog", label: "Catálogo", isVisibleFor: (role) => can(role, "catalog", "write") },
  { href: "/users", label: "Usuarios", isVisibleFor: (role) => can(role, "users", "list") },
  { href: "/audit", label: "Auditoría", isVisibleFor: (role) => can(role, "audit", "read") },
];

/** Items the given role may open (operators never see Catálogo, Usuarios nor Auditoría). Pure. */
export function navItemsFor(role: Role): readonly NavItem[] {
  return NAV_ITEMS.filter((item) => item.isVisibleFor(role));
}

const isUnder = (pathname: string, prefix: string): boolean =>
  pathname === prefix || pathname.startsWith(`${prefix}/`);

/** `true` when `pathname` is the item's page or one of its sub-pages. Pure. */
export function isNavItemActive(item: NavItem, pathname: string): boolean {
  if (item.href === "/" ? pathname === "/" : isUnder(pathname, item.href)) return true;
  return (item.sectionPrefixes ?? []).some((prefix) => isUnder(pathname, prefix));
}
