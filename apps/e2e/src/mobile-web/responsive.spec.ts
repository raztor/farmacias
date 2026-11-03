import { expect, test } from "../support/fixtures.ts";
import { REFLOW_VIEWPORT, horizontalOverflow } from "../support/layout.ts";

/** T-12 / RNF-03: the resident app reflows on every engine and phone viewport of the matrix. */
test.describe("mobile-web: diseño responsivo (RNF-03)", () => {
  for (const path of ["/", "/sign-in"]) {
    test(`«${path}» no tiene scroll horizontal en el viewport del proyecto ni a 320 px`, async ({
      page,
    }) => {
      await page.goto(path);
      await expect(page.getByRole("heading").first()).toBeVisible();
      expect(await horizontalOverflow(page)).toBe(0);

      await page.setViewportSize(REFLOW_VIEWPORT);
      await expect(page.getByRole("heading").first()).toBeVisible();
      expect(await horizontalOverflow(page)).toBe(0);
    });
  }
});
