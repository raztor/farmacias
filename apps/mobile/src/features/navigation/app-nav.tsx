import { FOCUS_RING_CLASSES, cn, webAria } from "@repo/ui";
import { Link, usePathname } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { useAuthState } from "../auth";
import { useCartItemCount } from "../cart";
import { NAV_ITEMS, activeNavHref, navLabel, type NavItem } from "./nav-items";

type NavLinkProps = Readonly<{ item: NavItem; label: string; active: boolean }>;

function NavLink({ item, label, active }: NavLinkProps) {
  return (
    <Link href={item.href} asChild>
      <Pressable
        role="link"
        accessibilityLabel={label}
        accessibilityState={{ selected: active }}
        {...webAria({ "aria-current": active ? "page" : false })}
        testID={item.testID}
        className={cn(
          "min-h-12 grow basis-1/4 items-center justify-center border-t-4 px-2 py-2",
          active ? "border-primary dark:border-primary-dark" : "border-transparent",
          FOCUS_RING_CLASSES,
        )}
      >
        <Text
          className={cn(
            "text-center text-sm",
            active
              ? "font-bold text-primary underline dark:text-primary-dark"
              : "font-medium text-foreground dark:text-foreground-dark",
          )}
        >
          {label}
        </Text>
      </Pressable>
    </Link>
  );
}

/** Main navigation bar (bottom): catalog, cart, my orders and account. */
export function AppNav() {
  const pathname = usePathname();
  const { isSignedIn } = useAuthState();
  const cartItemCount = useCartItemCount(isSignedIn);
  const active = activeNavHref(pathname);

  return (
    <View
      role="navigation"
      aria-label="Navegación principal"
      className="flex-row flex-wrap border-t border-border bg-background pb-safe px-safe dark:border-border-dark dark:bg-background-dark"
    >
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.href}
          item={item}
          label={navLabel(item, cartItemCount)}
          active={item.href === active}
        />
      ))}
    </View>
  );
}
