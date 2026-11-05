import { expect, test } from "../support/fixtures.ts";
import { REFLOW_VIEWPORT, reflowProblems } from "../support/layout.ts";

/**
 * T-12 / RNF-03: the resident app reflows on every engine and phone viewport of the matrix.
 * `reflowProblems` also looks inside the screen's scroll view, where RN-web clips content that
 * does not fit instead of widening the document (RNF-02).
 */
test.describe("mobile-web: diseño responsivo (RNF-03)", () => {
  for (const path of ["/", "/sign-in"]) {
    test(`«${path}» no tiene scroll horizontal ni contenido recortado en el viewport del proyecto ni a 320 px`, async ({
      page,
    }) => {
      await page.goto(path);
      await expect(page.getByRole("heading").first()).toBeVisible();
      expect(await reflowProblems(page)).toEqual([]);

      await page.setViewportSize(REFLOW_VIEWPORT);
      await expect(page.getByRole("heading").first()).toBeVisible();
      expect(await reflowProblems(page)).toEqual([]);
    });
  }
});
