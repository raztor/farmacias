import { expect, mobileWebSlot, openSignedIn, test } from "../support/fixtures.ts";
import {
  PRODUCT_LANES,
  addToDraft,
  payOrder,
  pickProduct,
  placePickupOrder,
  stockOf,
} from "../support/orders-api.ts";
import { trpcErrorCode } from "../support/trpc-http.ts";

const LINE_MAX = 99;

/**
 * HU-14 / D-30: «Repetir pedido» adds a previous order's products to the current cart, keeping
 * what the cart already had, capped by the units on hand, and the cart lists what changed. The
 * resident's own payment is the only stock change of this lane product. Another resident gets
 * NOT_FOUND (D-10) and the pharmacy staff FORBIDDEN.
 */
test.describe("mobile-web: repetir un pedido anterior (HU-14)", () => {
  test("suma el pedido pagado al carrito, ajusta la cantidad a la disponibilidad y lo avisa", async ({
    page,
    publicApi,
    operator,
    newResident,
  }, testInfo) => {
    const resident = await newResident("repetir pedido");
    const product = await pickProduct(publicApi, {
      index: PRODUCT_LANES.repeatOrder + mobileWebSlot(testInfo),
    });
    const order = await placePickupOrder(resident.api, product.id, 2);
    await payOrder(resident.api, order.id, "approve");
    // The cart already holds all but one of the units allowed: only 1 of the 2 fits.
    const stock = await stockOf(publicApi, product.id);
    const lineMax = Math.min(stock, LINE_MAX);
    await addToDraft(resident.api, product.id, lineMax - 1);
    const cause = stock > LINE_MAX ? "(máximo 99 por producto)" : "por disponibilidad";

    await test.step("«Repetir pedido» abre «Mi pedido» con el aviso de cambios", async () => {
      await openSignedIn(page, `/order/${order.id}`, resident);
      await expect(page.getByTestId("order-status")).toContainText("Pago validado");
      await page.getByRole("button", { name: "Repetir pedido" }).click();

      await expect(page).toHaveURL(/\/cart/);
      const notice = page.getByTestId("cart-repeat-notice");
      await expect(notice).toContainText(`Agregamos el pedido ${order.code} con cambios`);
      // The notice takes the focus, so screen readers read it even though it was already there.
      await expect(notice).toBeFocused();
      const changeLine = page.getByTestId("cart-repeat-change");
      // «Nombre (presentación): …»: products may share a commercial name.
      await expect(changeLine).toContainText(`${product.commercialName} (`);
      await expect(changeLine).toContainText(`se agregó 1 de 2 ${cause}`);
      await expect(page.getByTestId(`cart-quantity-${product.id}-value`)).toHaveText(
        String(lineMax),
      );
    });

    await test.step("al confirmar ese carrito el aviso ya no vuelve a aparecer", async () => {
      await page.getByTestId("cart-checkout").click();
      await page.getByTestId("fulfillment-pickup").click();
      await page.getByTestId("checkout-confirm").click();
      await expect(page).toHaveURL(/\/pay\//);
      await page.goto("/cart");
      await expect(page.getByTestId("cart-empty")).toBeVisible();
      await expect(page.getByTestId("cart-repeat-notice")).toBeHidden();
    });

    await test.step("repetir en un carrito vacío lo agrega todo; «Entendido» cierra el aviso", async () => {
      await page.goto(`/order/${order.id}`);
      await page.getByRole("button", { name: "Repetir pedido" }).click();
      const notice = page.getByTestId("cart-repeat-notice");
      await expect(notice).toContainText(`Agregamos los productos del pedido ${order.code}`);
      await expect(page.getByTestId(`cart-quantity-${product.id}-value`)).toHaveText("2");
      await page.getByTestId("cart-repeat-dismiss").click();
      await expect(notice).toBeHidden();
      await expect(page.getByTestId(`cart-line-${product.id}`)).toBeVisible();
    });

    await test.step("otra cuenta y el personal no pueden repetirlo (D-10)", async () => {
      const other = await newResident("repetir pedido ajeno");
      expect(
        await trpcErrorCode(() => other.api.trpc.mutation("orders.repeat", { orderId: order.id })),
      ).toBe("NOT_FOUND");
      expect(
        await trpcErrorCode(() => operator.trpc.mutation("orders.repeat", { orderId: order.id })),
      ).toBe("FORBIDDEN");
    });
  });
});
