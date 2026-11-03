export type NavItem = Readonly<{
  href: "/" | "/cart" | "/orders" | "/account";
  label: string;
  testID: string;
  /** Other paths that belong to this section (product detail → «Catálogo»…). */
  prefixes: readonly string[];
}>;

export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/", label: "Catálogo", testID: "nav-catalog", prefixes: ["/product/"] },
  { href: "/cart", label: "Mi pedido", testID: "nav-cart", prefixes: ["/checkout"] },
  { href: "/orders", label: "Mis pedidos", testID: "nav-orders", prefixes: ["/order/", "/pay/"] },
  {
    href: "/account",
    label: "Mi cuenta",
    testID: "nav-account",
    prefixes: ["/profile", "/sign-in"],
  },
];

/** Section of the navigation bar that contains `pathname`, or `null`. Pure. */
export function activeNavHref(pathname: string): NavItem["href"] | null {
  const item = NAV_ITEMS.find(
    ({ href, prefixes }) =>
      pathname === href || prefixes.some((prefix) => pathname.startsWith(prefix)),
  );
  return item?.href ?? null;
}

/** «Mi pedido (3)»: the cart label shows its units. Pure. */
export function navLabel(item: NavItem, cartItemCount: number): string {
  return item.href === "/cart" && cartItemCount > 0
    ? `${item.label} (${String(cartItemCount)})`
    : item.label;
}
