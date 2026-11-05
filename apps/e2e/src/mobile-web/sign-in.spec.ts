import { expect, signInOnMobileWeb, test } from "../support/fixtures.ts";
import { E2E_ACCOUNTS } from "../support/env.ts";

/** Generic message of HU-02 #2 (`INVALID_CREDENTIALS_MESSAGE` in `@repo/shared`). */
const INVALID_CREDENTIALS =
  "Correo o contraseña incorrectos. Revisa tus datos e inténtalo de nuevo.";
/** R-ACC-11 (`RESIDENT_APP_ONLY_MESSAGE` in `@repo/shared`). */
const RESIDENT_APP_ONLY = "Esta app es para personas inscritas.";

test.describe("mobile-web: inicio de sesión", () => {
  test("muestra la pantalla de inicio de sesión en español, sin registro", async ({ page }) => {
    await page.goto("/sign-in");

    await expect(page.getByRole("heading", { name: "Iniciar sesión" })).toBeVisible();
    await expect(
      page.getByText(
        "Ingresa con el correo y la contraseña de tu cuenta de la Farmacia Comunitaria.",
      ),
    ).toBeVisible();
    await expect(page.getByLabel("Correo electrónico")).toBeVisible();
    await expect(page.getByLabel("Contraseña")).toBeVisible();
    await expect(page.getByTestId("sign-in-submit")).toBeVisible();
    // No public sign-up (T-03): accounts are preregistered.
    await expect(page.getByText("Regístrate")).toHaveCount(0);
    await expect(page.getByTestId("auth-footer")).toContainText("acércate a la farmacia");
  });

  test("valida los campos sin llamar a la API", async ({ page }) => {
    await page.goto("/sign-in");
    await expect(page.getByTestId("sign-in-submit")).toBeVisible();
    // Recorded from here on: the session check of the page load is not a sign-in attempt.
    const signInCalls: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/api/auth/sign-in")) signInCalls.push(request.url());
    });

    await page.getByTestId("sign-in-submit").click();

    await expect(page.getByText("Ingresa un correo electrónico válido")).toBeVisible();
    await expect(page.getByText("Ingresa tu contraseña")).toBeVisible();
    // The form calls `signIn.mutate` in the same press handler, so a request would be out already.
    expect(signInCalls).toEqual([]);
  });

  test("una persona inscrita inicia sesión y vuelve a la pantalla pedida (HU-02 #1)", async ({
    page,
    newResident,
  }) => {
    const resident = await newResident("inicio de sesión");

    await page.goto("/sign-in?redirect=%2Forders");
    await signInOnMobileWeb(page, resident);

    await expect(page.getByTestId("orders-title")).toHaveText("Mis pedidos");
    await expect(page).toHaveURL(/\/orders/);
  });

  test("credenciales inválidas muestran un mensaje genérico (HU-02 #2)", async ({
    page,
    newResident,
  }) => {
    const resident = await newResident("credenciales inválidas");
    const attempts = [
      { email: resident.email, password: "clave-incorrecta-123" },
      { email: "no-existe@demo.farmacia.cl", password: resident.password },
    ];
    for (const attempt of attempts) {
      await page.goto("/sign-in");
      await signInOnMobileWeb(page, attempt);

      await expect(page.getByText(INVALID_CREDENTIALS)).toBeVisible();
      await expect(page.getByTestId("sign-in-submit")).toBeVisible();
    }
  });

  test("el personal de la farmacia no ingresa a la app de vecinos (R-ACC-11)", async ({ page }) => {
    await page.goto("/sign-in");
    await signInOnMobileWeb(page, E2E_ACCOUNTS.operator);

    await expect(page.getByText(RESIDENT_APP_ONLY)).toBeVisible();
    await expect(page.getByTestId("sign-in-submit")).toBeVisible();
  });
});
