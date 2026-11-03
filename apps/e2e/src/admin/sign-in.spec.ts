import { expect, test } from "@playwright/test";

test.describe("admin: inicio de sesión", () => {
  test("muestra el formulario en español", async ({ page }) => {
    await page.goto("/sign-in");

    await expect(page.getByRole("heading", { level: 1, name: "Iniciar sesión" })).toBeVisible();
    await expect(page.getByText("Acceso exclusivo para administradores.")).toBeVisible();
    await expect(page.getByLabel("Correo electrónico")).toBeVisible();
    await expect(page.getByLabel("Contraseña")).toBeVisible();
    await expect(page.getByRole("button", { name: "Iniciar sesión" })).toBeVisible();
  });

  test("valida los campos sin llamar a la API", async ({ page }) => {
    await page.goto("/sign-in");

    await page.getByRole("button", { name: "Iniciar sesión" }).click();

    await expect(page.getByText("Ingresa un correo electrónico válido")).toBeVisible();
    await expect(page.getByText("Ingresa tu contraseña")).toBeVisible();
  });

  test("redirige a /sign-in sin sesión", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveURL(/\/sign-in/);
  });
});
