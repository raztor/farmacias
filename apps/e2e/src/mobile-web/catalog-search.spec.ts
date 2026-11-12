import { isE2eProduct } from "../support/catalog-api.ts";
import { expect, projectSlot, test } from "../support/fixtures.ts";
import { catalogProducts } from "../support/orders-api.ts";
import { hasDiacritics, stripDiacritics } from "../support/search-terms.ts";

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
    // A product whose active ingredient has an accent (Losartán, Bupropión…), so the term below
    // really drops one. Read-only test: no lane needed, each project takes a different one.
    // Temporary products of the catalog maintenance spec come and go mid-run: never picked.
    const accented = (await catalogProducts(publicApi)).filter(
      (item) => hasDiacritics(item.activeIngredient) && !isE2eProduct(item),
    );
    const product = accented[projectSlot(testInfo) % accented.length];
    if (product === undefined) throw new Error("The seed catalog has no accented ingredient");
    // Upper case and without accents: the search is accent/case-insensitive (R-CAT-02).
    const term = stripDiacritics(product.activeIngredient).toUpperCase();
    expect(term, "el término debe perder al menos una tilde").not.toBe(
      product.activeIngredient.toUpperCase(),
    );

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
