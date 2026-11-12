import { describe, expect, it } from "vitest";

import { NAV_ITEMS, isNavItemActive, navItemsFor } from "./nav-items";

const labelsFor = (role: Parameters<typeof navItemsFor>[0]) =>
  navItemsFor(role).map((item) => item.label);

const item = (label: string) => {
  const found = NAV_ITEMS.find((navItem) => navItem.label === label);
  if (found === undefined) throw new Error(`missing nav item ${label}`);
  return found;
};

describe("navItemsFor", () => {
  it("shows the queue, inventory, alerts, catalog, users, audit and reports sections to admins", () => {
    expect(labelsFor("admin")).toEqual([
      "Bandeja",
      "Inventario",
      "Alertas de stock",
      "Catálogo",
      "Usuarios",
      "Auditoría",
      "Reportes",
    ]);
  });

  it("shows the queue, inventory and alerts to operators (no Catálogo, Usuarios, Auditoría nor Reportes)", () => {
    expect(labelsFor("operator")).toEqual(["Bandeja", "Inventario", "Alertas de stock"]);
  });

  it("shows nothing to residents (they get the 'Sin acceso' page anyway)", () => {
    expect(labelsFor("resident")).toEqual([]);
  });
});

describe("isNavItemActive", () => {
  it("marks the queue on the home page and on order details", () => {
    expect(isNavItemActive(item("Bandeja"), "/")).toBe(true);
    expect(isNavItemActive(item("Bandeja"), "/orders/abc")).toBe(true);
    expect(isNavItemActive(item("Bandeja"), "/users")).toBe(false);
  });

  it("marks a section and its sub-pages only", () => {
    expect(isNavItemActive(item("Auditoría"), "/audit")).toBe(true);
    expect(isNavItemActive(item("Usuarios"), "/users/u1")).toBe(true);
    expect(isNavItemActive(item("Usuarios"), "/usersx")).toBe(false);
    expect(isNavItemActive(item("Inventario"), "/inventory/p-1")).toBe(true);
    expect(isNavItemActive(item("Catálogo"), "/catalog/new")).toBe(true);
    expect(isNavItemActive(item("Catálogo"), "/catalog/prod-1")).toBe(true);
    expect(isNavItemActive(item("Reportes"), "/reports")).toBe(true);
  });
});
