import { E2E_ACCOUNTS } from "../support/env.ts";
import { expect, signInOnAdmin, test } from "../support/fixtures.ts";
import { REFLOW_VIEWPORT, reflowProblems } from "../support/layout.ts";

/**
 * T-12 / RNF-03: the back office works on desktop and on a phone-sized window. The queue table
 * hides secondary columns and scrolls inside its own box, never the whole page (the WCAG 1.4.10
 * data-table exception `reflowProblems` allows); no other box may clip or scroll sideways.
 */
test.describe("admin: diseño responsivo (RNF-03)", () => {
  test("inicio de sesión y bandeja sin scroll horizontal ni contenido recortado en escritorio y a 320 px", async ({
    page,
  }) => {
    await page.goto("/sign-in");
    expect(await reflowProblems(page)).toEqual([]);

    await signInOnAdmin(page, E2E_ACCOUNTS.operator);
    await expect(page.getByRole("heading", { name: "Bandeja de pedidos" })).toBeVisible();
    await expect(page.getByRole("table")).toBeVisible();
    expect(await reflowProblems(page)).toEqual([]);

    await page.setViewportSize(REFLOW_VIEWPORT);
    await expect(page.getByRole("table")).toBeVisible();
    expect(await reflowProblems(page)).toEqual([]);
  });
});
