import { expect, projectSlot, signInOnAdmin, test } from "../support/fixtures.ts";
import { PRODUCT_LANES, pickProduct, placePickupOrder } from "../support/orders-api.ts";
import { trpcErrorCode } from "../support/trpc-http.ts";

/**
 * HU-07 #2 / RNF-05: the back office is for operators and admins only. A resident who signs in
 * sees «Sin acceso» on every page, and the API answers FORBIDDEN to `operations.*`.
 */
test.describe("admin: acceso denegado a residentes (HU-07 #2)", () => {
  test("un residente no puede abrir la bandeja ni el detalle de un pedido", async ({
    page,
    publicApi,
    newResident,
  }, testInfo) => {
    const resident = await newResident("sin acceso admin");
    const product = await pickProduct(publicApi, {
      index: PRODUCT_LANES.accessControl + projectSlot(testInfo),
    });
    const order = await placePickupOrder(resident.api, product.id, 1);

    expect(await trpcErrorCode(() => resident.api.trpc.query("operations.queue", {}))).toBe(
      "FORBIDDEN",
    );
    expect(
      await trpcErrorCode(() =>
        resident.api.trpc.mutation("operations.transition", {
          id: order.id,
          to: "cancelled",
          expectedVersion: order.version,
        }),
      ),
    ).toBe("FORBIDDEN");

    await signInOnAdmin(page, resident);
    const denied = page.getByRole("heading", { name: "No tienes acceso a la administración" });
    await expect(denied).toBeVisible();
    await expect(page.getByText(resident.email)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Bandeja de pedidos" })).toHaveCount(0);

    // Even its own order: the detail route is behind the same guard.
    await page.goto(`/orders/${order.id}`);
    await expect(denied).toBeVisible();
    await expect(page.getByText(order.code)).toHaveCount(0);
  });
});
