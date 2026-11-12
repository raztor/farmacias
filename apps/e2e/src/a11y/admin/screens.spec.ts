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
  test("inicio de sesión, bandeja, detalle, confirmación, usuarios, catálogo y auditoría", async ({
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

    await test.step("catálogo: listado, nuevo producto y edición (HU-11, solo administración)", async () => {
      await page.goto("/catalog");
      const list = page.getByRole("heading", { level: 1, name: "Catálogo" });
      await check("admin-catalogo", list);
      // Status as text (SC 1.4.1): «Activo» / «Inactivo» in each row, never color only.
      await expect(page.getByRole("row").nth(1)).toContainText(/Activo|Inactivo/);
      await page.goto("/catalog/new");
      await check("admin-catalogo-nuevo", page.getByRole("form", { name: "Nuevo producto" }));
      // Viewing only (never saved): the lane product keeps its data and price.
      await page.goto(`/catalog/${product.id}`);
      await check("admin-catalogo-editar", page.getByRole("button", { name: "Guardar cambios" }));
    });

    await test.step("auditoría (solo administración)", async () => {
      await page.goto("/audit");
      await check("admin-auditoria", page.getByRole("heading", { level: 1, name: "Auditoría" }));
    });

    expect(problems, problems.join("\n")).toEqual([]);
  });
});
