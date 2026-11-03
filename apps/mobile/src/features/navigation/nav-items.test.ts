import { describe, expect, it } from "vitest";

import { NAV_ITEMS, activeNavHref, navLabel } from "./nav-items";

describe("activeNavHref", () => {
  it.each([
    ["/", "/"],
    ["/product/abc", "/"],
    ["/cart", "/cart"],
    ["/checkout", "/cart"],
    ["/orders", "/orders"],
    ["/order/abc", "/orders"],
    ["/pay/abc", "/orders"],
    ["/account", "/account"],
    ["/profile", "/account"],
    ["/sign-in", "/account"],
  ])("marks %s as part of %s", (pathname, expected) => {
    expect(activeNavHref(pathname)).toBe(expected);
  });

  it("returns null for unknown paths", () => {
    expect(activeNavHref("/unknown")).toBeNull();
  });
});

describe("navLabel", () => {
  const cart = NAV_ITEMS.find((item) => item.href === "/cart");
  const catalog = NAV_ITEMS.find((item) => item.href === "/");

  it("shows the units of the cart", () => {
    if (!cart || !catalog) throw new Error("missing nav items");

    expect(navLabel(cart, 3)).toBe("Mi pedido (3)");
    expect(navLabel(cart, 0)).toBe("Mi pedido");
    expect(navLabel(catalog, 3)).toBe("Catálogo");
  });
});
