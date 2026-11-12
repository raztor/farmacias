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
    const lineMax = Math.min(await stockOf(publicApi, product.id), LINE_MAX);
    await addToDraft(resident.api, product.id, lineMax - 1);

    await test.step("«Repetir pedido» abre «Mi pedido» con el aviso de cambios", async () => {
      await openSignedIn(page, `/order/${order.id}`, resident);
      await expect(page.getByTestId("order-status")).toContainText("Pago validado");
      await page.getByRole("button", { name: "Repetir pedido" }).click();

      await expect(page).toHaveURL(/\/cart/);
      const notice = page.getByTestId("cart-repeat-notice");
      await expect(notice).toContainText(`Agregamos el pedido ${order.code} con cambios`);
      await expect(page.getByTestId("cart-repeat-change")).toHaveText(
        `${product.commercialName}: se agregó 1 de 2 por disponibilidad`,
      );
      await expect(page.getByTestId(`cart-quantity-${product.id}-value`)).toHaveText(
        String(lineMax),
      );
    });

    await test.step("«Entendido» cierra el aviso y el carrito se mantiene", async () => {
      await page.getByTestId("cart-repeat-dismiss").click();
      await expect(page.getByTestId("cart-repeat-notice")).toBeHidden();
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
