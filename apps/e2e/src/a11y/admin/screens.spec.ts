import { checkScreen } from "../../support/a11y.ts";
import { E2E_ACCOUNTS } from "../../support/env.ts";
import { expect, signInOnAdmin, test } from "../../support/fixtures.ts";
import {
  PRODUCT_LANES,
  payOrder,
  pickProduct,
  placePickupOrder,
} from "../../support/orders-api.ts";

/** Sub-lane offset of the admin audit (the resident specs use 0 and 4). */
const ADMIN_LANE_OFFSET = 8;

/**
 * T-09 (RNF-01, RNF-02): every critical screen of the back office passes axe with the WCAG 2.1
 * A/AA rules (no serious or critical violations) and reflows at 200 % zoom (640 px) without
 * horizontal scroll. Order status is shown as text plus a symbol, never only as a color.
 */
test.describe("a11y admin: pantallas críticas (axe + zoom 200 %)", () => {
  test("inicio de sesión, bandeja, detalle, confirmación, usuarios, auditoría e inventario", async ({
    page,
    publicApi,
    newResident,
  }, testInfo) => {
    const resident = await newResident("a11y admin");
    const product = await pickProduct(publicApi, {
      index: PRODUCT_LANES.accessibility + ADMIN_LANE_OFFSET + testInfo.repeatEachIndex,
    });
    const placed = await placePickupOrder(resident.api, product.id, 1);
    await payOrder(resident.api, placed.id, "approve");
    const problems: string[] = [];
    const check = async (screen: string, ready: Parameters<typeof checkScreen>[3]) => {
      problems.push(...(await checkScreen(page, testInfo, screen, ready)));
    };

    await test.step("inicio de sesión", async () => {
      await page.goto("/sign-in");
      await check("admin-inicio-sesion", page.getByLabel("Correo electrónico"));
    });

    await test.step("bandeja de pedidos (HU-07)", async () => {
      await signInOnAdmin(page, E2E_ACCOUNTS.admin);
      await page.goto(`/?code=${placed.code}`);
      const row = page.getByRole("row").filter({ hasText: placed.code });
      await check("admin-bandeja", row);
      // Status as text (SC 1.4.1): the label is in the row, the color only reinforces it.
      await expect(row).toContainText("Pago validado");
    });

    await test.step("detalle del pedido y confirmación de avance (HU-08)", async () => {
      await page.getByRole("link", { name: `Ver pedido ${placed.code}` }).click();
      const heading = page.getByRole("heading", { level: 1, name: `Pedido ${placed.code}` });
      await check("admin-detalle", heading);
      const panel = page.getByRole("region", { name: "Registrar avance" });
      await panel.getByRole("button", { name: "Iniciar preparación", exact: true }).click();
      await check("admin-confirmacion", panel.getByRole("button", { name: /^Sí, / }));
    });

    await test.step("usuarios (solo administración)", async () => {
      await page.goto("/users");
      await check("admin-usuarios", page.getByRole("heading", { level: 1, name: "Usuarios" }));
      await expect(page.getByRole("combobox", { name: /^Rol de / }).first()).toBeVisible();
    });

    await test.step("auditoría (solo administración)", async () => {
      await page.goto("/audit");
      await check("admin-auditoria", page.getByRole("heading", { level: 1, name: "Auditoría" }));
    });

    await test.step("inventario y ficha de stock (HU-10)", async () => {
      await page.goto(`/inventory?q=${encodeURIComponent(product.commercialName)}`);
      await check("admin-inventario", page.locator(`a[href="/inventory/${product.id}"]`));
      await page.goto(`/inventory/${product.id}`);
      const form = page.getByRole("form", { name: "Registrar recepción o ajuste" });
      await check("admin-ficha-stock", form);
      // Errors are announced and tied to their field (SC 3.3.1, 4.1.3).
      await form.getByRole("button", { name: "Registrar recepción" }).click();
      await expect(form.getByLabel("Cantidad de unidades")).toHaveAttribute("aria-invalid", "true");
      await check("admin-ficha-stock-errores", form.getByRole("alert").first());
    });

    expect(problems, problems.join("\n")).toEqual([]);
  });
});
