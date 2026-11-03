import { expect, projectSlot, test } from "../support/fixtures.ts";
import { PRODUCT_LANES, pickProduct } from "../support/orders-api.ts";

/**
 * HU-01 (CAT-E01, CAT-E02): anonymous search on the Expo web app. Results show name, price and
 * availability as text (never color only); a term without results says so and lets the person
 * change it.
 */
test.describe("mobile-web: buscador del catálogo (HU-01)", () => {
  test("busca sin sesión por principio activo, sin importar tildes ni mayúsculas", async ({
    page,
    publicApi,
  }, testInfo) => {
    const product = await pickProduct(publicApi, {
      index: PRODUCT_LANES.accessControl + projectSlot(testInfo),
    });
    // Upper case and without accents: the search is accent/case-insensitive (R-CAT-02).
    const term = product.activeIngredient
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toUpperCase();

    await page.goto("/");
    await page.getByTestId("catalog-search-input").fill(term);
    const results = page.getByRole("list", { name: "Resultados de la búsqueda" });
    await expect(results).toBeVisible();
    await expect(page.getByTestId("catalog-count")).toContainText("Mostrando");
    const card = results.getByTestId(`product-card-${product.id}`);
    await expect(card).toContainText(product.commercialName);
    await expect(card).toContainText(product.activeIngredient);
    await expect(card.getByTestId("product-card-price")).toContainText("$");
    await expect(card).toContainText(/Disponible|Quedan pocas|Sin stock/);
  });

  test("un término sin resultados lo dice y permite modificar la búsqueda", async ({ page }) => {
    await page.goto("/");
    const input = page.getByTestId("catalog-search-input");
    await input.fill("zzz producto inexistente");

    const empty = page.getByTestId("catalog-empty");
    await expect(empty).toContainText("No encontramos resultados");
    await expect(empty).toContainText("«zzz producto inexistente»");
    await page.getByTestId("catalog-empty-clear").click();
    await expect(input).toHaveValue("");
    await expect(input).toBeFocused();
    await expect(page.getByRole("list", { name: "Resultados de la búsqueda" })).toBeVisible();
  });
});
