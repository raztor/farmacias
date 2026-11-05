import { expect, signInOnAdmin, test } from "../support/fixtures.ts";
import { E2E_ACCOUNTS } from "../support/env.ts";

/** Generic message of HU-02 #2 (`INVALID_CREDENTIALS_MESSAGE` in `@repo/shared`). */
const INVALID_CREDENTIALS =
  "Correo o contraseña incorrectos. Revisa tus datos e inténtalo de nuevo.";

test.describe("admin: inicio de sesión", () => {
  test("muestra el formulario en español", async ({ page }) => {
    await page.goto("/sign-in");

    await expect(page.getByRole("heading", { level: 1, name: "Iniciar sesión" })).toBeVisible();
    await expect(
      page.getByText("Acceso exclusivo para el personal autorizado de la farmacia."),
    ).toBeVisible();
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

  test("inicia sesión con los permisos de cada rol (HU-02 #1)", async ({ page }) => {
    const nav = page.getByRole("navigation", { name: "Navegación principal" });

    await signInOnAdmin(page, E2E_ACCOUNTS.operator);
    await expect(page.getByRole("heading", { name: "Bandeja de pedidos" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Bandeja" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Usuarios" })).toHaveCount(0);
    await expect(nav.getByRole("link", { name: "Auditoría" })).toHaveCount(0);

    await page.context().clearCookies();
    await signInOnAdmin(page, E2E_ACCOUNTS.admin);
    await expect(nav.getByRole("link", { name: "Usuarios" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Auditoría" })).toBeVisible();
  });

  test("credenciales inválidas muestran un mensaje genérico (HU-02 #2)", async ({ page }) => {
    const attempts = [
      { email: E2E_ACCOUNTS.operator.email, password: "clave-incorrecta-123" },
      { email: "no-existe@demo.farmacia.cl", password: E2E_ACCOUNTS.operator.password },
    ];
    for (const attempt of attempts) {
      await page.goto("/sign-in");
      await page.getByLabel("Correo electrónico").fill(attempt.email);
      await page.getByLabel("Contraseña").fill(attempt.password);
      await page.getByRole("button", { name: "Iniciar sesión" }).click();

      await expect(page.getByText(INVALID_CREDENTIALS)).toBeVisible();
      await expect(page).toHaveURL(/\/sign-in/);
    }
  });
});
