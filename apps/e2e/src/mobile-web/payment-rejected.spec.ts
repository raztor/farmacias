import { expect, openSignedIn, projectSlot, test } from "../support/fixtures.ts";
import {
  PRODUCT_LANES,
  pickProduct,
  placePickupOrder,
  residentOrder,
  stockOf,
} from "../support/orders-api.ts";

/**
 * HU-05 #2 / RF-08: a rejected simulated payment says so, lets the resident try again and never
 * touches the inventory (verified through the API, not the UI).
 */
test.describe("mobile-web: pago rechazado (HU-05 #2, RF-08)", () => {
  test("informa el rechazo, permite reintentar y no cambia el stock", async ({
    page,
    publicApi,
    newResident,
  }, testInfo) => {
    const resident = await newResident("pago rechazado");
    const product = await pickProduct(publicApi, {
      index: PRODUCT_LANES.rejectedPayment + projectSlot(testInfo),
    });
    const stockBefore = await stockOf(publicApi, product.id);
    const order = await placePickupOrder(resident.api, product.id, 2);
    expect(order.status).toBe("pending_payment");

    await openSignedIn(page, `/pay/${order.id}`, resident);
    await expect(page.getByTestId("payment-title")).toBeVisible();
    await page.getByTestId("pay-reject").click();

    const result = page.getByTestId("payment-result-rejected");
    await expect(result).toBeVisible();
    await expect(result).toContainText("Pago rechazado");
    await expect(page.getByTestId("payment-try-again")).toBeVisible();

    // Verified through the API: same stock, order in «Pago rechazado».
    expect(await stockOf(publicApi, product.id)).toBe(stockBefore);
    const after = await residentOrder(resident.api, order.id);
    expect(after.status).toBe("payment_rejected");
    expect(after.timeline.at(-1)).toBe("payment_rejected");

    await page.getByTestId("payment-view-order").click();
    await expect(page.getByTestId("order-status")).toContainText("Pago rechazado");
    await expect(page.getByTestId("order-go-to-pay")).toContainText("Intentar el pago de nuevo");
  });
});
