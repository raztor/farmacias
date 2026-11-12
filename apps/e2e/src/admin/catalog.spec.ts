import type { Page } from "@playwright/test";

import { adminApi, type ApiSession } from "../support/api-session.ts";
import { deactivateE2eProducts, syntheticProduct } from "../support/catalog-api.ts";
import { E2E_ACCOUNTS } from "../support/env.ts";
import { expect, signInOnAdmin, test } from "../support/fixtures.ts";
import { isRecord, trpcErrorCode } from "../support/trpc-http.ts";

const ADMIN_ONLY =
  "Solo los administradores del programa pueden mantener el catálogo y sus precios.";

type SyntheticProduct = ReturnType<typeof syntheticProduct>;

/** Saves the open product form and waits for the success toast and the list. */
async function save(page: Page, button: string, toast: string) {
  await page.getByRole("button", { name: button }).click();
  await expect(page.getByRole("status").filter({ hasText: toast })).toBeVisible();
  await expect(page).toHaveURL(/\/catalog$/);
}

/** Fills the «Nuevo producto» form (price typed with a thousands separator). */
async function fillNewProduct(page: Page, product: SyntheticProduct) {
  const form = page.getByRole("form", { name: "Nuevo producto" });
  await form.getByLabel("Nombre comercial").fill(product.commercialName);
  await form.getByLabel("Principio activo").fill(product.activeIngredient);
  await form.getByLabel("Presentación").fill(product.presentation);
  await form.getByLabel("Categoría").selectOption("analgesicos");
  await form.getByLabel("SKU").fill(product.sku.toLowerCase());
  await form.getByLabel("Precio (CLP)").fill("1.990");
  return form;
}

/** Public search items (anonymous `catalog.search`) for a term. */
async function publicSearch(api: ApiSession, q: string) {
  const result = await api.trpc.query("catalog.search", { q });
  const items = isRecord(result) && Array.isArray(result.items) ? result.items : [];
  return items.filter(isRecord);
}

/**
 * HU-11 (RF-14, D-28): only the admin maintains the catalog. A new product starts without stock
 * and shows up in the public catalog right away; a price change is reflected there too;
 * deactivating it removes it from the public catalog (never deleted). Each run creates its own
 * temporary product (`E2E HU11 …`, stock 0, outside the product lanes) and deactivates it at the
 * end even if a step fails.
 */
test.describe("admin: mantención del catálogo (HU-11)", () => {
  test("el administrador crea un producto, edita su precio y lo desactiva", async ({
    page,
    publicApi,
    playwright,
  }) => {
    const product = syntheticProduct();
    const row = page.getByRole("row").filter({ hasText: product.commercialName });
    try {
      await signInOnAdmin(page, E2E_ACCOUNTS.admin);

      await test.step("crea el producto desde «Nuevo producto»", async () => {
        await page
          .getByRole("navigation", { name: "Navegación principal" })
          .getByRole("link", { name: "Catálogo" })
          .click();
        await expect(page.getByRole("heading", { level: 1, name: "Catálogo" })).toBeVisible();
        await page.getByRole("link", { name: "Nuevo producto" }).click();
        await fillNewProduct(page, product);
        await save(page, "Crear producto", `Producto «${product.commercialName}» creado.`);
      });

      await test.step("aparece en el listado y en el catálogo público, sin stock", async () => {
        await page.getByLabel("Buscar productos").fill(product.tag);
        await expect(row).toContainText(product.sku);
        await expect(row).toContainText("$1.990");
        await expect(row).toContainText("Sin stock");
        await expect(row).toContainText("Activo");
        const [found, ...rest] = await publicSearch(publicApi, product.tag);
        expect(rest).toEqual([]);
        expect(found).toMatchObject({ priceClp: 1990, availableQty: 0, availability: "out" });
      });

      await test.step("un SKU repetido se informa en su campo, sin crear nada", async () => {
        await page.getByRole("link", { name: "Nuevo producto" }).click();
        const form = await fillNewProduct(page, product);
        await form.getByLabel("Precio (CLP)").press("Enter");
        const sku = form.getByLabel("SKU");
        await expect(form.getByText("Ya existe un producto con ese SKU.")).toBeVisible();
        await expect(sku).toHaveAttribute("aria-invalid", "true");
        await expect(sku).toBeFocused();
        await form.getByRole("link", { name: "Cancelar" }).click();
      });

      const productId = await test.step("edita el precio", async () => {
        await page.getByLabel("Buscar productos").fill(product.tag);
        await row.getByRole("link", { name: `Editar ${product.commercialName}` }).click();
        await expect(
          page.getByRole("heading", { level: 1, name: `Editar ${product.commercialName}` }),
        ).toBeVisible();
        const id = decodeURIComponent(new URL(page.url()).pathname.split("/").at(-1) ?? "");
        await page.getByLabel("Precio (CLP)").fill("2490");
        await save(page, "Guardar cambios", `Cambios de «${product.commercialName}» guardados.`);
        await page.getByLabel("Buscar productos").fill(product.tag);
        await expect(row).toContainText("$2.490");
        expect(await publicApi.trpc.query("catalog.byId", { id })).toMatchObject({
          priceClp: 2490,
        });
        return id;
      });

      await test.step("lo desactiva: sale del catálogo público, sigue en el listado", async () => {
        await row.getByRole("link", { name: `Editar ${product.commercialName}` }).click();
        await page.getByLabel("Producto activo").uncheck();
        await save(page, "Guardar cambios", `Cambios de «${product.commercialName}» guardados.`);
        await page.getByLabel("Buscar productos").fill(product.tag);
        await expect(row).toContainText("Inactivo");
        expect(await publicSearch(publicApi, product.tag)).toEqual([]);
        expect(
          await trpcErrorCode(() => publicApi.trpc.query("catalog.byId", { id: productId })),
        ).toBe("NOT_FOUND");
      });
    } finally {
      // Never leave the temporary product in the public catalog, even after a failed step.
      const admin = await adminApi(playwright.request);
      try {
        await deactivateE2eProducts(admin, product.tag);
      } finally {
        await admin.dispose();
      }
    }
  });

  test("operarios, residentes y visitantes no pueden mantener el catálogo", async ({
    page,
    operator,
    publicApi,
    newResident,
  }) => {
    const { tag: _tag, ...fields } = syntheticProduct();
    const input = { ...fields, category: "otros", priceClp: 990, active: true };
    const resident = await newResident("sin catálogo");

    expect(await trpcErrorCode(() => operator.trpc.query("catalog.adminList", {}))).toBe(
      "FORBIDDEN",
    );
    expect(await trpcErrorCode(() => operator.trpc.mutation("catalog.create", input))).toBe(
      "FORBIDDEN",
    );
    expect(await trpcErrorCode(() => resident.api.trpc.mutation("catalog.create", input))).toBe(
      "FORBIDDEN",
    );
    expect(await trpcErrorCode(() => publicApi.trpc.mutation("catalog.create", input))).toBe(
      "UNAUTHORIZED",
    );

    await signInOnAdmin(page, E2E_ACCOUNTS.operator);
    const nav = page.getByRole("navigation", { name: "Navegación principal" });
    await expect(nav.getByRole("link", { name: "Bandeja" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Catálogo" })).toHaveCount(0);
    for (const path of ["/catalog", "/catalog/new"]) {
      await page.goto(path);
      await expect(page.getByText(ADMIN_ONLY)).toBeVisible();
      await expect(page.getByRole("form")).toHaveCount(0);
      await expect(page.getByRole("link", { name: "Nuevo producto" })).toHaveCount(0);
    }
  });
});
