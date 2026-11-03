import type { Page } from "@playwright/test";

/**
 * Reflow check (RNF-03, WCAG 1.4.10): 320 CSS px wide equals a 1280 px screen at 400 % zoom.
 * The page must not need horizontal scrolling at that width.
 */
export const REFLOW_VIEWPORT = { width: 320, height: 720 } as const;

/** Horizontal overflow of the document in CSS px (0 = no horizontal scroll). */
export async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => {
    const width = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
    return Math.max(0, width - document.documentElement.clientWidth);
  });
}
