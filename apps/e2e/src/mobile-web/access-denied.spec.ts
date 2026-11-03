import { expect, openSignedIn, projectSlot, test } from "../support/fixtures.ts";
import { PRODUCT_LANES, pickProduct, placePickupOrder } from "../support/orders-api.ts";
import { trpcErrorCode } from "../support/trpc-http.ts";

/**
 * HU-09 #2 / RNF-05: a resident never sees another resident's order. The API answers NOT_FOUND
 * (not FORBIDDEN) so order ids cannot be enumerated (docs/specs/tracking.md).
 */
test.describe("mobile-web: acceso denegado entre cuentas (HU-09 #2)", () => {
  test("un residente no puede abrir el pedido de otro residente", async ({
    page,
    publicApi,
    newResident,
  }, testInfo) => {
    const owner = await newResident("dueño");
    const intruder = await newResident("otro residente");
    const product = await pickProduct(publicApi, {
      index: PRODUCT_LANES.accessControl + projectSlot(testInfo),
    });
    const order = await placePickupOrder(owner.api, product.id, 1);

    expect(
      await trpcErrorCode(() => intruder.api.trpc.query("orders.detail", { id: order.id })),
    ).toBe("NOT_FOUND");
    expect(
      await trpcErrorCode(() =>
        intruder.api.trpc.mutation("orders.cancel", {
          id: order.id,
          expectedVersion: order.version,
        }),
      ),
    ).toBe("NOT_FOUND");

    await openSignedIn(page, `/order/${order.id}`, intruder);
    await expect(
      page.getByRole("alert").filter({ hasText: "No encontramos ese pedido." }),
    ).toBeVisible();
    await expect(page.getByText(order.code)).toHaveCount(0);
    await expect(page.getByTestId("order-status")).toHaveCount(0);
  });
});
