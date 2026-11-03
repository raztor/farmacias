import { checkScreen } from "../../support/a11y.ts";
import { expect, openSignedIn, test } from "../../support/fixtures.ts";
import { PRODUCT_LANES, addToDraft, pickProduct } from "../../support/orders-api.ts";

/**
 * T-09 (RNF-01, RNF-02): every critical screen of the resident app (Expo web) passes axe with
 * the WCAG 2.1 A/AA rules (no serious or critical violations) and reflows at 200 % zoom
 * (640 px) without horizontal scroll. Status is always conveyed with text, not only color.
 */
test.describe("a11y mobile-web: pantallas críticas (axe + zoom 200 %)", () => {
  test("catálogo, producto, inicio de sesión, pedido, confirmación, pago, mis pedidos y detalle", async ({
    page,
    publicApi,
    newResident,
  }, testInfo) => {
    const resident = await newResident("a11y pantallas");
    const product = await pickProduct(publicApi, {
      index: PRODUCT_LANES.accessibility + testInfo.repeatEachIndex,
    });
    const problems: string[] = [];
    const check = async (screen: string, ready: Parameters<typeof checkScreen>[3]) => {
      problems.push(...(await checkScreen(page, testInfo, screen, ready)));
    };

    await test.step("catálogo público (HU-01)", async () => {
      await page.goto("/");
      await page.getByTestId("catalog-search-input").fill(product.commercialName);
      const card = page.getByTestId(`product-card-${product.id}`);
      await check("catalogo", card);
      // Availability is text («Disponible», «Quedan pocas»…), never only a color (SC 1.4.1).
      await expect(card.getByLabel(/^Disponibilidad: \S/)).toBeVisible();
    });

    await test.step("detalle de producto", async () => {
      await page.goto(`/product/${product.id}`);
      await check("producto", page.getByTestId("product-name"));
      await expect(page.getByTestId("product-availability")).toHaveText(/\S/);
    });

    await test.step("inicio de sesión (HU-02)", async () => {
      await page.goto("/sign-in");
      await check("inicio-sesion", page.getByTestId("sign-in-email"));
      await expect(page.getByRole("textbox", { name: /correo/i })).toBeVisible();
      await expect(page.getByRole("button", { name: "Iniciar sesión" })).toBeVisible();
    });

    await test.step("mi pedido (HU-03)", async () => {
      await addToDraft(resident.api, product.id, 1);
      await openSignedIn(page, "/cart", resident);
      await check("mi-pedido", page.getByTestId("cart-title"));
    });

    await test.step("confirmar: despacho simulado y retiro (HU-04)", async () => {
      await page.getByTestId("cart-checkout").click();
      await page.getByTestId("fulfillment-delivery").click();
      await check("confirmar-despacho", page.getByTestId("checkout-confirm"));
      await page.getByTestId("fulfillment-pickup").click();
      await check("confirmar-retiro", page.getByTestId("pickup-summary"));
      await page.getByTestId("checkout-confirm").click();
    });

    await test.step("pago simulado y resultado (HU-05)", async () => {
      await expect(page).toHaveURL(/\/pay\//);
      await check("pago", page.getByTestId("pay-approve"));
      await page.getByTestId("pay-approve").click();
      await check("pago-resultado", page.getByTestId("payment-result-approved"));
      await page.getByTestId("payment-view-order").click();
    });

    await test.step("detalle y línea de tiempo (HU-09)", async () => {
      await expect(page).toHaveURL(/\/order\//);
      await check("detalle-pedido", page.getByTestId("order-timeline"));
      // The status badge carries the label as text, not only its color.
      await expect(page.getByTestId("order-status")).toContainText("Pago validado");
    });

    await test.step("mis pedidos (HU-09)", async () => {
      await page.goto("/orders");
      await check("mis-pedidos", page.getByRole("list", { name: "Tus pedidos" }));
      await expect(page.getByRole("list", { name: "Tus pedidos" })).toContainText("Pago validado");
    });

    expect(problems, problems.join("\n")).toEqual([]);
  });
});
