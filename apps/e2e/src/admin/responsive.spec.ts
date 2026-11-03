import { E2E_ACCOUNTS } from "../support/env.ts";
import { expect, signInOnAdmin, test } from "../support/fixtures.ts";
import { REFLOW_VIEWPORT, horizontalOverflow } from "../support/layout.ts";

/**
 * T-12 / RNF-03: the back office works on desktop and on a phone-sized window. The queue table
 * hides secondary columns and scrolls inside its own box, never the whole page.
 */
test.describe("admin: diseño responsivo (RNF-03)", () => {
  test("inicio de sesión y bandeja sin scroll horizontal en escritorio y a 320 px", async ({
    page,
  }) => {
    await page.goto("/sign-in");
    expect(await horizontalOverflow(page)).toBe(0);

    await signInOnAdmin(page, E2E_ACCOUNTS.operator);
    await expect(page.getByRole("heading", { name: "Bandeja de pedidos" })).toBeVisible();
    await expect(page.getByRole("table")).toBeVisible();
    expect(await horizontalOverflow(page)).toBe(0);

    await page.setViewportSize(REFLOW_VIEWPORT);
    await expect(page.getByRole("table")).toBeVisible();
    expect(await horizontalOverflow(page)).toBe(0);
  });
});
