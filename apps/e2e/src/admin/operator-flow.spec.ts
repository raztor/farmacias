import type { Locator, Page } from "@playwright/test";

import { E2E_ACCOUNTS } from "../support/env.ts";
import { expect, projectSlot, signInOnAdmin, test } from "../support/fixtures.ts";
import {
  PRODUCT_LANES,
  operationsOrder,
  payOrder,
  pickProduct,
  placePickupOrder,
  residentOrder,
} from "../support/orders-api.ts";
import { trpcErrorCode } from "../support/trpc-http.ts";

/** Registers one transition from the detail page: button → confirmation → success toast. */
async function advance(
  page: Page,
  panel: Locator,
  step: { action: string; status: string; code: string },
) {
  await panel.getByRole("button", { name: step.action, exact: true }).click();
  await panel.getByRole("button", { name: `Sí, ${step.action.toLowerCase()}` }).click();
  await expect(
    page.getByText(`Listo: el pedido ${step.code} quedó en «${step.status}».`),
  ).toBeVisible();
}

/**
 * Operator path in the back office (T-08): HU-07 queue with filters → HU-08 physical progress of
 * a pickup order («En preparación» → «Listo para retiro» → «Entregado»). Only the transitions the state
 * machine allows are offered, and the API rejects any other one (§4.6).
 */
test.describe("admin: bandeja y avance de un pedido (HU-07, HU-08)", () => {
  test("filtra la bandeja y lleva un pedido de retiro hasta «Entregado»", async ({
    page,
    publicApi,
    operator,
    newResident,
  }, testInfo) => {
    const resident = await newResident("bandeja");
    const product = await pickProduct(publicApi, {
      index: PRODUCT_LANES.operatorFlow + projectSlot(testInfo),
    });
    const placed = await placePickupOrder(resident.api, product.id, 1);
    expect((await payOrder(resident.api, placed.id, "approve")).status).toBe("payment_validated");

    await test.step("HU-07: filtra por estado, modalidad y código", async () => {
      await signInOnAdmin(page, E2E_ACCOUNTS.operator);
      await expect(page.getByRole("heading", { name: "Bandeja de pedidos" })).toBeVisible();
      const filters = page.getByRole("search", { name: "Filtrar pedidos" });
      await filters.getByLabel("Pago validado", { exact: true }).check();
      await filters.getByLabel("Modalidad").selectOption("pickup");
      await filters.getByLabel("Código de pedido").fill(placed.code);
      await filters.getByRole("button", { name: "Aplicar filtros" }).click();

      await expect(page).toHaveURL(/status=payment_validated/);
      await expect(page).toHaveURL(/fulfillment=pickup/);
      const rows = page.getByRole("table").getByRole("row");
      await expect(rows).toHaveCount(2); // header + the order
      await expect(rows.nth(1)).toContainText("Pago validado");
      await expect(rows.nth(1)).toContainText("Retiro en farmacia");
      await page.getByRole("link", { name: `Ver pedido ${placed.code}` }).click();
    });

    const panel = page.getByRole("region", { name: "Registrar avance" });

    await test.step("HU-08: solo ofrece las transiciones válidas", async () => {
      await expect(
        page.getByRole("heading", { level: 1, name: `Pedido ${placed.code}` }),
      ).toBeVisible();
      await expect(panel.getByRole("button", { name: "Iniciar preparación" })).toBeVisible();
      for (const invalid of [
        "Marcar listo para retiro",
        "Despachar (en ruta)",
        "Marcar entregado",
      ]) {
        await expect(panel.getByRole("button", { name: invalid })).toHaveCount(0);
      }
    });

    await test.step("HU-08: En preparación → Listo para retiro → Entregado", async () => {
      const code = placed.code;
      await advance(page, panel, { action: "Iniciar preparación", status: "En preparación", code });
      // Pickup order: «en ruta» is never offered (only for delivery).
      await expect(panel.getByRole("button", { name: "Despachar (en ruta)" })).toHaveCount(0);
      await advance(page, panel, {
        action: "Marcar listo para retiro",
        status: "Listo para retiro",
        code,
      });
      await advance(page, panel, { action: "Marcar entregado", status: "Entregado", code });
      await expect(panel).toContainText("No hay cambios de estado que puedas registrar");
      await expect(panel.getByRole("button")).toHaveCount(0);
    });

    await test.step("la API rechaza una transición inválida y el historial queda completo", async () => {
      const delivered = await operationsOrder(operator, placed.id);
      expect(delivered.status).toBe("delivered");
      expect(delivered.allowedTransitions).toEqual([]);
      const code = await trpcErrorCode(() =>
        operator.trpc.mutation("operations.transition", {
          id: placed.id,
          to: "in_preparation",
          expectedVersion: delivered.version,
        }),
      );
      expect(code).toBe("CONFLICT");

      const tracked = await residentOrder(resident.api, placed.id);
      expect(tracked.timeline.slice(-4)).toEqual([
        "payment_validated",
        "in_preparation",
        "ready_for_pickup",
        "delivered",
      ]);
    });
  });
});
