import { hasFocus, keyboardWalker } from "../../support/a11y.ts";
import { expect, test } from "../../support/fixtures.ts";
import { PRODUCT_LANES, pickProduct } from "../../support/orders-api.ts";

/** Sub-lane offset of this spec: never the product of `screens.spec.ts` (offset 0). */
const KEYBOARD_LANE_OFFSET = 4;

/**
 * T-09 (RNF-01): the whole critical resident flow works with the keyboard only (no mouse
 * clicks): search → product → sign-in → add → cart → pickup → simulated payment → order
 * detail. Every control shows a visible focus indicator and the tab order follows the screen.
 */
test.describe("a11y mobile-web: flujo crítico solo con teclado (RNF-01)", () => {
  test("busca, inicia sesión, agrega, confirma retiro y paga sin usar el mouse", async ({
    page,
    publicApi,
    newResident,
  }, testInfo) => {
    const resident = await newResident("a11y teclado");
    const product = await pickProduct(publicApi, {
      index: PRODUCT_LANES.accessibility + KEYBOARD_LANE_OFFSET + testInfo.repeatEachIndex,
    });
    const keys = keyboardWalker(page, testInfo);

    await test.step("catálogo: escribe la búsqueda y abre el producto con Enter", async () => {
      await page.goto("/");
      await expect(page.getByTestId("catalog-title")).toBeVisible();
      await keys.focus(page.getByTestId("catalog-search-input"));
      await page.keyboard.type(product.commercialName);
      await keys.activate(page.getByTestId(`product-card-${product.id}`));
      await expect(page.getByTestId("product-name")).toHaveText(product.commercialName);
    });

    await test.step("inicio de sesión: correo → contraseña → Ingresar en orden", async () => {
      await keys.activate(page.getByTestId("add-sign-in"));
      await expect(page).toHaveURL(/\/sign-in/);
      const email = page.getByTestId("sign-in-email");
      await keys.focus(email);
      await page.keyboard.type(resident.email);
      // Tab order follows the form: the next stop after the email is the password.
      await page.keyboard.press("Tab");
      expect(await hasFocus(page.getByTestId("sign-in-password"))).toBe(true);
      await page.keyboard.type(resident.password);
      await keys.activate(page.getByTestId("sign-in-submit"));
      await expect(page.getByTestId("product-name")).toHaveText(product.commercialName);
    });

    await test.step("agrega al pedido y va a «Mi pedido»", async () => {
      await keys.activate(page.getByTestId("add-to-order"));
      await expect(page.getByTestId("add-success")).toBeVisible();
      await keys.activate(page.getByTestId("add-go-to-cart"));
      await expect(page.getByTestId("cart-title")).toBeVisible();
      await keys.activate(page.getByTestId("cart-checkout"));
    });

    await test.step("elige «Retiro en farmacia» y confirma", async () => {
      await expect(page.getByTestId("checkout-title")).toBeVisible();
      await keys.activate(page.getByTestId("fulfillment-pickup"), "Space");
      await expect(page.getByTestId("pickup-summary")).toBeVisible();
      await keys.activate(page.getByTestId("checkout-confirm"));
      await expect(page).toHaveURL(/\/pay\//);
    });

    await test.step("simula el pago aprobado y abre el detalle", async () => {
      await keys.activate(page.getByRole("button", { name: /simular pago aprobado/i }));
      await expect(page.getByTestId("payment-result-approved")).toBeVisible();
      await keys.activate(page.getByTestId("payment-view-order"));
      await expect(page.getByTestId("order-status")).toContainText("Pago validado");
    });

    await test.step("la navegación principal es alcanzable y tiene foco visible", async () => {
      const nav = page.getByRole("navigation", { name: "Navegación principal" });
      await keys.activate(nav.getByRole("link", { name: /mis pedidos/i }));
      await expect(page.getByTestId("orders-title")).toBeVisible();
    });

    expect(keys.problems, keys.problems.join("\n")).toEqual([]);
  });
});
