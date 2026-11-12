import type { Locator, Page } from "@playwright/test";

import { E2E_ACCOUNTS } from "../support/env.ts";
import { expect, projectSlot, signInOnAdmin, test } from "../support/fixtures.ts";
import { PRODUCT_LANES, pickProduct, stockOf } from "../support/orders-api.ts";
import { trpcErrorCode } from "../support/trpc-http.ts";

/**
 * Sub-lane of the inventory spec inside the admin-only `operatorFlow` lane: admin projects come
 * first (indexes 0..4, plus the project count under `--repeat-each`), so `operator-flow.spec.ts`
 * uses the lane's slots 0..4 / 16..20 and this spec slots 5..9 / 21..25: no new lane needed.
 */
const INVENTORY_LANE_OFFSET = 5;

/** Fills and submits the receipt / adjustment form of the product stock page. */
async function submitStockChange(
  form: Locator,
  change: Readonly<{ kind: "Recepción" | "Ajuste"; quantity: string; reason: string }>,
) {
  await form.getByRole("radio", { name: new RegExp(`^${change.kind}`) }).check();
  await form.getByLabel("Cantidad de unidades").fill(change.quantity);
  await form.getByLabel("Motivo (obligatorio)").fill(change.reason);
  const submit = change.kind === "Recepción" ? "Registrar recepción" : "Registrar ajuste";
  await form.getByRole("button", { name: submit }).click();
}

const stockForm = (page: Page) => page.getByRole("form", { name: "Registrar recepción o ajuste" });

/**
 * HU-10 (D-25) in the back office: an operator finds a product in the inventory, registers a
 * receipt with its reason (stock, toast and ledger change), and a reasonless or negative
 * adjustment is rejected with a clear message without touching the stock.
 */
test.describe("admin: recepciones y ajustes de stock (HU-10)", () => {
  test("registra una recepción y rechaza ajustes sin motivo o que dejarían stock negativo", async ({
    page,
    publicApi,
    newResident,
  }, testInfo) => {
    const product = await pickProduct(publicApi, {
      index: PRODUCT_LANES.operatorFlow + INVENTORY_LANE_OFFSET + projectSlot(testInfo),
    });
    const before = await stockOf(publicApi, product.id);

    await test.step("el inventario lista el producto y lleva a su ficha de stock", async () => {
      await signInOnAdmin(page, E2E_ACCOUNTS.operator);
      await page
        .getByRole("navigation", { name: "Navegación principal" })
        .getByRole("link", { name: "Inventario" })
        .click();
      await expect(page.getByRole("heading", { level: 1, name: "Inventario" })).toBeVisible();
      const filters = page.getByRole("search", { name: "Filtrar inventario" });
      await filters.getByLabel("Buscar producto").fill(product.commercialName);
      await filters.getByRole("button", { name: "Aplicar filtros" }).click();
      await expect(page).toHaveURL(/[?&]q=/);
      const link = page.locator(`a[href="/inventory/${product.id}"]`);
      await expect(link).toHaveAccessibleName(`Ver stock de ${product.commercialName}`);
      await link.click();
      await expect(
        page.getByRole("heading", { level: 1, name: product.commercialName }),
      ).toBeVisible();
    });

    await test.step("HU-10 #1: la recepción suma unidades y queda en el historial", async () => {
      const reason = `Recepción E2E ${testInfo.project.name}`;
      await submitStockChange(stockForm(page), { kind: "Recepción", quantity: "7", reason });
      await expect(
        page.getByText(
          `Recepción registrada para ${product.commercialName} (+7 unidades). Stock actual: ${String(before + 7)} unidades.`,
        ),
      ).toBeVisible();
      const history = page.getByRole("region", { name: "Historial de movimientos" });
      const row = history.getByRole("row").filter({ hasText: reason });
      await expect(row).toContainText("Recepción");
      await expect(row).toContainText(`${String(before)} → ${String(before + 7)}`);
      await expect(row).toContainText("Operario");
      expect(await stockOf(publicApi, product.id)).toBe(before + 7);
    });

    await test.step("HU-10 #2: sin motivo, el formulario lo exige y no llama a la API", async () => {
      await submitStockChange(stockForm(page), { kind: "Ajuste", quantity: "-1", reason: "" });
      await expect(page.getByText("Indica el motivo (al menos 5 caracteres).")).toBeVisible();
      await expect(page.getByLabel("Motivo (obligatorio)")).toBeFocused();
      expect(await stockOf(publicApi, product.id)).toBe(before + 7);
    });

    await test.step("HU-10 #2: un ajuste que dejaría stock negativo se rechaza sin cambios", async () => {
      const quantity = `-${String(before + 8)}`;
      await submitStockChange(stockForm(page), {
        kind: "Ajuste",
        quantity,
        reason: "Conteo físico E2E",
      });
      await expect(
        stockForm(page)
          .getByRole("alert")
          .filter({ hasText: "El ajuste dejaría el stock en negativo." }),
      ).toBeVisible();
      expect(await stockOf(publicApi, product.id)).toBe(before + 7);
    });

    await test.step("una persona inscrita no puede ajustar stock por la API", async () => {
      const resident = await newResident("inventario");
      const code = await trpcErrorCode(() =>
        resident.api.trpc.mutation("inventory.adjust", {
          productId: product.id,
          kind: "receipt",
          delta: 1,
          reason: "Intento no autorizado",
        }),
      );
      expect(code).toBe("FORBIDDEN");
    });
  });
});
