import { hasFocus, keyboardWalker } from "../../support/a11y.ts";
import { E2E_ACCOUNTS } from "../../support/env.ts";
import { expect, test } from "../../support/fixtures.ts";
import {
  PRODUCT_LANES,
  payOrder,
  pickProduct,
  placePickupOrder,
} from "../../support/orders-api.ts";

/** Sub-lane offset of this spec (the other accessibility specs use 0, 4 and 8). */
const KEYBOARD_LANE_OFFSET = 12;

/**
 * T-09 (RNF-01): the operator flow of the back office works with the keyboard only: sign-in,
 * skip link, queue filter, order detail, transition with confirmation (Escape cancels) and the
 * main navigation. Every stop shows a visible focus indicator.
 */
test.describe("a11y admin: flujo del operario solo con teclado (RNF-01)", () => {
  test("inicia sesión, filtra, abre el pedido y registra un avance sin usar el mouse", async ({
    page,
    publicApi,
    newResident,
  }, testInfo) => {
    const resident = await newResident("a11y admin teclado");
    const product = await pickProduct(publicApi, {
      index: PRODUCT_LANES.accessibility + KEYBOARD_LANE_OFFSET + testInfo.repeatEachIndex,
    });
    const placed = await placePickupOrder(resident.api, product.id, 1);
    await payOrder(resident.api, placed.id, "approve");
    const keys = keyboardWalker(page, testInfo);

    await test.step("inicio de sesión: correo → contraseña → botón, en orden", async () => {
      await page.goto("/sign-in");
      await keys.focus(page.getByLabel("Correo electrónico"));
      await page.keyboard.type(E2E_ACCOUNTS.admin.email);
      await page.keyboard.press("Tab");
      expect(await hasFocus(page.getByLabel("Contraseña"))).toBe(true);
      await page.keyboard.type(E2E_ACCOUNTS.admin.password);
      await keys.activate(page.getByRole("button", { name: "Iniciar sesión" }));
      await expect(page.getByRole("heading", { name: "Bandeja de pedidos" })).toBeVisible();
    });

    await test.step("«Saltar al contenido» es la primera parada y lleva al contenido", async () => {
      await page.reload();
      await expect(page.getByRole("heading", { name: "Bandeja de pedidos" })).toBeVisible();
      await page.keyboard.press("Tab");
      const skip = page.getByRole("link", { name: "Saltar al contenido" });
      expect(await hasFocus(skip)).toBe(true);
      await expect(skip).toBeVisible();
      await page.keyboard.press("Enter");
      await expect(page.locator("#contenido")).toBeFocused();
    });

    await test.step("filtra la bandeja por código y abre el pedido (HU-07)", async () => {
      const filters = page.getByRole("search", { name: "Filtrar pedidos" });
      await keys.focus(filters.getByLabel("Código de pedido"));
      await page.keyboard.type(placed.code);
      await keys.activate(filters.getByRole("button", { name: "Aplicar filtros" }));
      await expect(page).toHaveURL(new RegExp(`code=${placed.code}`));
      await keys.activate(page.getByRole("link", { name: `Ver pedido ${placed.code}` }));
      await expect(
        page.getByRole("heading", { level: 1, name: `Pedido ${placed.code}` }),
      ).toBeVisible();
    });

    const panel = page.getByRole("region", { name: "Registrar avance" });

    await test.step("Escape cancela la confirmación sin cambiar el estado", async () => {
      await keys.activate(panel.getByRole("button", { name: "Iniciar preparación", exact: true }));
      // The confirmation takes the focus (its title), so the next Tab stays inside it.
      await expect(panel.getByRole("heading", { name: /^Confirmar:/ })).toBeFocused();
      await page.keyboard.press("Escape");
      await expect(panel.getByRole("button", { name: /^Sí, / })).toHaveCount(0);
    });

    await test.step("registra «En preparación» con Enter (HU-08)", async () => {
      await keys.activate(panel.getByRole("button", { name: "Iniciar preparación", exact: true }));
      await keys.activate(panel.getByRole("button", { name: "Sí, iniciar preparación" }));
      await expect(
        page.getByText(`Listo: el pedido ${placed.code} quedó en «En preparación».`),
      ).toBeVisible();
    });

    await test.step("la navegación principal lleva a «Usuarios» y su selector de rol", async () => {
      const nav = page.getByRole("navigation", { name: "Navegación principal" });
      await keys.activate(nav.getByRole("link", { name: "Usuarios" }), "Enter");
      await expect(page.getByRole("heading", { level: 1, name: "Usuarios" })).toBeVisible();
      await keys.focus(page.getByRole("combobox", { name: /^Rol de / }).first());
    });

    expect(keys.problems, keys.problems.join("\n")).toEqual([]);
  });
});
