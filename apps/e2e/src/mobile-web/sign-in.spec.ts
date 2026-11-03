import { expect, test } from "@playwright/test";

test.describe("mobile-web: inicio de sesión", () => {
  test("muestra la pantalla de inicio de sesión en español", async ({ page }) => {
    await page.goto("/sign-in");

    await expect(page.getByRole("heading", { name: "Iniciar sesión" })).toBeVisible();
    await expect(page.getByText("Ingresa con tu correo y contraseña.")).toBeVisible();
    await expect(page.getByLabel("Correo electrónico")).toBeVisible();
    await expect(page.getByLabel("Contraseña")).toBeVisible();
    await expect(page.getByTestId("sign-in-submit")).toBeVisible();
    await expect(page.getByRole("link", { name: "Regístrate" })).toBeVisible();
  });

  test("valida los campos sin llamar a la API", async ({ page }) => {
    await page.goto("/sign-in");

    await page.getByTestId("sign-in-submit").click();

    await expect(page.getByText("Ingresa un correo electrónico válido")).toBeVisible();
    await expect(page.getByText("Ingresa tu contraseña")).toBeVisible();
  });
});
