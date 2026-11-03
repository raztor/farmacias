import { expect, projectSlot, signInOnMobileWeb, test } from "../support/fixtures.ts";
import { PRODUCT_LANES, pickProduct, residentOrder, stockOf } from "../support/orders-api.ts";

/**
 * Critical resident path on the Expo web app (T-08): HU-01 search → HU-02 sign-in → HU-03 add
 * to the order → HU-04 pickup → HU-05 approved simulated payment → HU-09 timeline. The stock is
 * discounted exactly once, when the payment is approved (D-02, HU-06 #1).
 */
test.describe("mobile-web: flujo feliz del residente", () => {
  test("busca, inicia sesión, agrega, confirma retiro, paga y ve «Pago validado»", async ({
    page,
    publicApi,
    newResident,
  }, testInfo) => {
    const resident = await newResident("flujo feliz");
    const product = await pickProduct(publicApi, {
      index: PRODUCT_LANES.residentHappyPath + projectSlot(testInfo),
    });
    const stockBefore = await stockOf(publicApi, product.id);

    await test.step("HU-01: busca el medicamento sin iniciar sesión", async () => {
      await page.goto("/");
      await expect(page.getByTestId("catalog-title")).toBeVisible();
      await page.getByTestId("catalog-search-input").fill(product.commercialName);
      await page.getByTestId(`product-card-${product.id}`).click();
      await expect(page.getByTestId("product-name")).toHaveText(product.commercialName);
    });

    await test.step("HU-02: inicia sesión y vuelve al producto", async () => {
      await page.getByTestId("add-sign-in").click();
      await expect(page).toHaveURL(/\/sign-in/);
      await signInOnMobileWeb(page, resident);
      await expect(page.getByTestId("product-name")).toHaveText(product.commercialName);
    });

    await test.step("HU-03: agrega una unidad y revisa «Mi pedido»", async () => {
      await page.getByTestId("add-to-order").click();
      await expect(page.getByTestId("add-success")).toBeVisible();
      // No reservation while the order is a draft (D-02).
      expect(await stockOf(publicApi, product.id)).toBe(stockBefore);
      await page.getByTestId("add-go-to-cart").click();
      await expect(page.getByTestId("cart-title")).toBeVisible();
      await expect(page.getByRole("list", { name: "Productos de tu pedido" })).toContainText(
        product.commercialName,
      );
      await page.getByTestId("cart-checkout").click();
    });

    await test.step("HU-04: elige retiro en farmacia (sin dirección) y confirma", async () => {
      await expect(page.getByTestId("checkout-title")).toBeVisible();
      await page.getByTestId("fulfillment-pickup").click();
      await expect(page.getByTestId("pickup-summary")).toBeVisible();
      await expect(page.getByTestId("delivery-sector")).toHaveCount(0);
      await page.getByTestId("checkout-confirm").click();
      await expect(page).toHaveURL(/\/pay\//);
    });

    await test.step("HU-05: simula un pago aprobado", async () => {
      await expect(page.getByTestId("payment-title")).toBeVisible();
      await page.getByTestId("pay-approve").click();
      await expect(page.getByTestId("payment-result-approved")).toBeVisible();
      await page.getByTestId("payment-view-order").click();
    });

    await test.step("HU-09: el detalle muestra «Pago validado» y la línea de tiempo", async () => {
      await expect(page).toHaveURL(/\/order\//);
      await expect(page.getByTestId("order-status")).toContainText("Pago validado");
      const timeline = page.getByTestId("order-timeline");
      await expect(timeline).toContainText("Pendiente de pago");
      await expect(timeline).toContainText("Pago validado");
    });

    await test.step("D-02 / HU-06: el stock se descontó una sola vez (vía API)", async () => {
      const orderId = new URL(page.url()).pathname.split("/").at(-1) ?? "";
      const order = await residentOrder(resident.api, orderId);
      expect(order.status).toBe("payment_validated");
      expect(order.timeline.slice(-2)).toEqual(["pending_payment", "payment_validated"]);
      expect(await stockOf(publicApi, product.id)).toBe(stockBefore - 1);
    });
  });
});
