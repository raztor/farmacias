import { expect, openSignedIn, projectSlot, test } from "../support/fixtures.ts";
import { PRODUCT_LANES, addToDraft, pickProduct, residentOrder } from "../support/orders-api.ts";
import { isRecord, trpcErrorCode } from "../support/trpc-http.ts";

/**
 * HU-04 #2: simulated delivery requires sector, address reference and contact alias (synthetic
 * data only, D-04); the missing field is named and the order is not confirmed until it is fixed.
 */
test.describe("mobile-web: despacho simulado (HU-04)", () => {
  test("exige sector, referencia y alias, e indica el campo que falta", async ({
    page,
    publicApi,
    newResident,
  }, testInfo) => {
    const resident = await newResident("despacho");
    const product = await pickProduct(publicApi, {
      index: PRODUCT_LANES.deliveryValidation + projectSlot(testInfo),
    });
    await addToDraft(resident.api, product.id, 1);

    await test.step("la API rechaza un despacho sin alias de contacto (HU-04 #2)", async () => {
      const code = await trpcErrorCode(() =>
        resident.api.trpc.mutation("orders.setFulfillment", {
          type: "delivery",
          sector: "Lo Hermida",
          addressReference: "Pasaje Ficticio 123",
        }),
      );
      expect(code).toBe("BAD_REQUEST");
    });

    await test.step("el formulario marca los campos faltantes y no confirma", async () => {
      await openSignedIn(page, "/checkout", resident);
      await expect(page.getByTestId("checkout-title")).toBeVisible();
      await page.getByTestId("fulfillment-delivery").click();
      await page.getByTestId("delivery-sector").fill("Lo Hermida");
      await page.getByTestId("checkout-confirm").click();

      await expect(page.getByText("Indica una referencia de dirección")).toBeVisible();
      await expect(page.getByText("Indica un alias de contacto")).toBeVisible();
      await expect(page.getByText("Indica el sector")).toHaveCount(0);
      await expect(page).toHaveURL(/\/checkout/);
      const draft: unknown = await resident.api.trpc.query("orders.draft");
      expect(isRecord(draft) ? draft.status : null).toBe("draft");
    });

    await test.step("con los datos sintéticos completos confirma el pedido", async () => {
      await page.getByTestId("delivery-addressReference").fill("Pasaje Ficticio 123");
      await page.getByTestId("delivery-contactAlias").fill("Vecina Ana");
      await page.getByTestId("checkout-confirm").click();
      await expect(page).toHaveURL(/\/pay\//);
      const orderId = new URL(page.url()).pathname.split("/").at(-1) ?? "";
      const order = await residentOrder(resident.api, orderId);
      expect(order.status).toBe("pending_payment");
    });
  });
});
