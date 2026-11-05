import { AxeBuilder } from "@axe-core/playwright";
import { expect, type Locator, type Page, type TestInfo } from "@playwright/test";

import { reflowProblems } from "./layout.ts";

/**
 * Accessibility helpers of the T-09 audit (RNF-01, RNF-02; docs/validation/accesibilidad.md).
 *
 * - `auditScreen` runs axe-core with the WCAG 2.0/2.1 A and AA rules and returns the violations
 *   that block the release (impact `serious` or `critical`); minor ones are recorded as test
 *   annotations so the report lists them without failing.
 * - `tabTo` / `focusIndicator` drive and inspect keyboard focus (SC 2.1.1, 2.4.3, 2.4.7).
 * - `ZOOM_200_VIEWPORT` emulates a 1280 px window at 200 % zoom (SC 1.4.4, 1.4.10).
 */

export const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

/** axe impacts that count as critical defects for the "zero critical defects" target. */
const BLOCKING_IMPACTS = new Set(["serious", "critical"]);

/** 1280 CSS px at 200 % zoom: the page must reflow into 640 px without horizontal scroll. */
export const ZOOM_200_VIEWPORT = { width: 640, height: 800 } as const;

type AxeResults = Awaited<ReturnType<AxeBuilder["analyze"]>>;
type AxeViolation = AxeResults["violations"][number];

const describeViolation = (violation: AxeViolation): string => {
  const targets = violation.nodes
    .slice(0, 3)
    .map((node) => node.target.join(" "))
    .join(" | ");
  const impact = violation.impact ?? "unknown";
  return `[${impact}] ${violation.id}: ${violation.help} (${String(violation.nodes.length)} nodos: ${targets})`;
};

/**
 * Runs axe on the current page and returns the blocking violations (empty = pass). The full axe
 * result is attached to the test report; non-blocking violations become `a11y-minor`
 * annotations.
 */
export async function auditScreen(page: Page, testInfo: TestInfo, screen: string) {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  await testInfo.attach(`axe-${screen}`, {
    body: JSON.stringify(results.violations, null, 2),
    contentType: "application/json",
  });
  const blocking: string[] = [];
  for (const violation of results.violations) {
    const line = `${screen}: ${describeViolation(violation)}`;
    if (BLOCKING_IMPACTS.has(violation.impact ?? "")) blocking.push(line);
    else testInfo.annotations.push({ type: "a11y-minor", description: line });
  }
  return blocking;
}

/** True when the element (or something inside it) has the keyboard focus. */
export function hasFocus(target: Locator): Promise<boolean> {
  return target.evaluate(
    (element) =>
      document.activeElement !== null &&
      (element === document.activeElement || element.contains(document.activeElement)),
  );
}

/**
 * Presses Tab (or Shift+Tab) until `target` has the focus, like a keyboard-only user. Fails
 * when it is not reachable within `maxPresses`, i.e. the control is not keyboard operable.
 */
export async function tabTo(
  page: Page,
  target: Locator,
  options: Readonly<{ maxPresses?: number; backwards?: boolean }> = {},
): Promise<number> {
  const key = options.backwards === true ? "Shift+Tab" : "Tab";
  const maxPresses = options.maxPresses ?? 60;
  for (let presses = 1; presses <= maxPresses; presses += 1) {
    await page.keyboard.press(key);
    if (await hasFocus(target)) return presses;
  }
  throw new Error(`Not reachable with ${key} in ${String(maxPresses)} presses: ${String(target)}`);
}

export type FocusIndicator = Readonly<{
  /** Visible outline or ring (box-shadow) on the focused element (SC 2.4.7). */
  visible: boolean;
  /** Tag, accessible text and the computed styles that were inspected. */
  detail: string;
}>;

/** Inspects the computed style of `document.activeElement` while it has the focus. */
export function focusIndicator(page: Page): Promise<FocusIndicator> {
  return page.evaluate(() => {
    const element = document.activeElement;
    if (!(element instanceof HTMLElement) || element === document.body) {
      return { visible: false, detail: "ningún elemento tiene el foco" };
    }
    const COLOR = /rgba?\([^)]*\)/;
    // `outline: 2px solid transparent` (Tailwind `outline-none`) is not an indicator.
    const opaque = (color: string) => color !== "transparent" && !/rgba\([^)]*,\s*0\)/.test(color);
    const style = getComputedStyle(element);
    const outline =
      style.outlineStyle !== "none" &&
      Number.parseFloat(style.outlineWidth) > 0 &&
      opaque(style.outlineColor);
    // Tailwind rings are box-shadows: visible when one layer has an opaque color and a size.
    const ring = (style.boxShadow === "none" ? [] : style.boxShadow.split(/,(?![^(]*\))/)).find(
      (layer) => {
        const sizes = layer.replace(COLOR, "").trim().split(/\s+/).map(Number.parseFloat);
        return opaque(COLOR.exec(layer)?.[0] ?? "") && sizes.some((size) => size > 0);
      },
    );
    const name = (element.getAttribute("aria-label") ?? element.textContent).trim();
    const how = outline
      ? `outline ${style.outlineWidth} ${style.outlineColor}`
      : (ring?.trim() ??
        `sin indicador (outline ${style.outlineColor}, box-shadow ${style.boxShadow})`);
    return {
      visible: outline || ring !== undefined,
      detail: `<${element.tagName.toLowerCase()}> «${name.slice(0, 50)}» ${how}`,
    };
  });
}

/**
 * Full check of one screen: axe (WCAG A/AA, serious + critical) at the project viewport, then
 * the same screen at 200 % zoom (640 px) must keep `ready` visible, with no horizontal scroll of
 * the document and no box that clips or scrolls its content sideways (`reflowProblems`).
 * Returns the problems found (empty = pass) so a walk over several screens reports all of them.
 */
export async function checkScreen(
  page: Page,
  testInfo: TestInfo,
  screen: string,
  ready: Locator,
): Promise<string[]> {
  await expect(ready).toBeVisible();
  const problems = await auditScreen(page, testInfo, screen);
  const viewport = page.viewportSize();
  await page.setViewportSize(ZOOM_200_VIEWPORT);
  await expect(ready).toBeVisible();
  for (const problem of await reflowProblems(page)) {
    problems.push(`${screen} a 640 px (zoom 200 %): ${problem}`);
  }
  if (viewport !== null) await page.setViewportSize(viewport);
  return problems;
}

export type KeyboardWalker = Readonly<{
  /** Tabs to `target` and records a problem when its focus indicator is not visible. */
  focus: (target: Locator) => Promise<void>;
  /** Tabs to `target` and activates it with `key` (`Enter` by default, `Space` for radios). */
  activate: (target: Locator, key?: "Enter" | "Space") => Promise<void>;
  /** Controls reached without a visible focus indicator (empty = pass). */
  problems: string[];
}>;

/**
 * Keyboard-only driver for a critical flow (SC 2.1.1, 2.4.7): every stop is reached with Tab,
 * its focus style is recorded as a `focus` annotation (evidence for the report) and checked.
 */
export function keyboardWalker(page: Page, testInfo: TestInfo): KeyboardWalker {
  const problems: string[] = [];
  const focus = async (target: Locator) => {
    const presses = await tabTo(page, target);
    const indicator = await focusIndicator(page);
    testInfo.annotations.push({
      type: "focus",
      description: `${String(presses)}× Tab → ${indicator.detail}`,
    });
    if (!indicator.visible) problems.push(`sin foco visible: ${indicator.detail}`);
  };
  const activate = async (target: Locator, key: "Enter" | "Space" = "Enter") => {
    await focus(target);
    await page.keyboard.press(key);
  };
  return { focus, activate, problems };
}
