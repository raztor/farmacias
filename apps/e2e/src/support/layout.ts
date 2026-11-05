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

/**
 * Boxes whose content is wider than the box itself (WCAG 1.4.10, RNF-02), one line each:
 * - `overflow-x: hidden | clip`: the extra content is cut off, so information is lost;
 * - `overflow-x: auto | scroll`: the box scrolls sideways, except a box that holds a data table
 *   (the WCAG 1.4.10 exception the admin queue, users, audit and order-line tables rely on).
 *
 * The document measure alone cannot see the first case on the resident app: every screen sits in
 * a react-native-web `ScrollView` (`overflow-x: hidden`), the Expo web template sets
 * `body { overflow: hidden }` and RN-web views shrink (`min-width: 0`), so a row that does not
 * fit is clipped inside the scroll view and the document never gets wider.
 *
 * Skipped: form fields (they scroll their own text), visually hidden boxes (`sr-only`: 1 px wide or
 * clipped with `clip` / `clip-path`, like a skip link until it gets the focus) and hidden elements. The line names the box and the first descendant that sticks out.
 */
export async function clippedBoxes(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const TOLERANCE = 1;
    const SKIPPED_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);
    const name = (element: Element): string => {
      const testId = element.getAttribute("data-testid");
      const label = element.getAttribute("aria-label");
      const tag = element.tagName.toLowerCase();
      const text = element.textContent.trim().slice(0, 40);
      if (testId !== null) return `<${tag} data-testid="${testId}">`;
      if (label !== null) return `<${tag} aria-label="${label}">`;
      return `<${tag}> «${text}»`;
    };
    // `sr-only` (also with padding, like a skip link until it gets the focus): clipped on purpose.
    // `clip` is deprecated but Tailwind 3's and many `sr-only` utilities still set it.
    const visuallyHidden = (style: CSSStyleDeclaration) => {
      const clip = style.getPropertyValue("clip");
      return style.clipPath !== "none" || (clip !== "auto" && clip !== "");
    };
    const clips = (element: HTMLElement): string | null => {
      if (SKIPPED_TAGS.has(element.tagName) || element.clientWidth <= TOLERANCE) return null;
      const style = getComputedStyle(element);
      const mode = style.overflowX;
      if (mode === "visible" || visuallyHidden(style)) return null;
      if (element.scrollWidth - element.clientWidth <= TOLERANCE) return null;
      const scrolls = mode === "auto" || mode === "scroll";
      if (scrolls && element.querySelector("table") !== null) return null;
      return mode;
    };
    const culprit = (box: HTMLElement): string => {
      const right = box.getBoundingClientRect().right + TOLERANCE;
      const outside = [...box.querySelectorAll("*")].find(
        (child) => child.getBoundingClientRect().right > right,
      );
      return outside === undefined ? "contenido" : name(outside);
    };
    const problems: string[] = [];
    for (const element of [document.body, ...document.body.querySelectorAll("*")]) {
      if (!(element instanceof HTMLElement)) continue;
      const mode = clips(element);
      if (mode === null) continue;
      const excess = element.scrollWidth - element.clientWidth;
      const effect = mode === "auto" || mode === "scroll" ? "scroll horizontal" : "recortados";
      problems.push(
        `${name(element)} (overflow-x: ${mode}): ${String(excess)} px ${effect}; sobresale ${culprit(element)}`,
      );
    }
    return problems;
  });
}

/**
 * Reflow problems at the current viewport (empty = pass): horizontal scroll of the document plus
 * every box that clips or scrolls its content sideways (`clippedBoxes`).
 */
export async function reflowProblems(page: Page): Promise<string[]> {
  const overflow = await horizontalOverflow(page);
  const document = overflow > 0 ? [`documento: ${String(overflow)} px de scroll horizontal`] : [];
  return [...document, ...(await clippedBoxes(page))];
}
