import { buildCatalogProducts } from "@repo/db";
import { buildProductSearchText, normalizeSearchText } from "@repo/shared";
import { describe, expect, it } from "vitest";

import { escapeLikePattern, termMatchers } from "./catalog.repository";

/** JS mirror of the SQL filter (`filtersSql`): every word, any alternative, all substrings. */
const matchesTerm = (searchText: string, term: string): boolean =>
  termMatchers(term).every((matcher) =>
    matcher.some((substrings) => substrings.every((text) => searchText.includes(text))),
  );

const seedSearchTexts = buildCatalogProducts().map(buildProductSearchText);
const seedMatches = (query: string) => {
  const term = normalizeSearchText(query);
  return seedSearchTexts.filter((searchText) => matchesTerm(searchText, term));
};

describe("termMatchers", () => {
  it("keeps one matcher per distinct word of a normalized term", () => {
    expect(termMatchers("celecoxib 200")).toEqual([[["celecoxib"]], [["200"]]]);
    expect(termMatchers("losartan")).toEqual([[["losartan"]]]);
    expect(termMatchers("mg mg 50")).toEqual([[["mg"]], [["50"]]]);
    expect(termMatchers("")).toEqual([]);
  });

  it("matches a dose glued to its unit as typed or spaced", () => {
    expect(termMatchers("losartan 50mg")).toEqual([[["losartan"]], [["50mg"], ["50 mg"]]]);
    expect(termMatchers("100mcg")).toEqual([[["100mcg"], ["100 mcg"]]]);
  });

  it("splits a word glued to a number into independent words, like typing it spaced", () => {
    expect(termMatchers("losartan50")).toEqual([[["losartan", "50"]]]);
    expect(termMatchers("losartan50mg")).toEqual([[["losartan", "50", "mg"]]]);
  });

  it("keeps short codes as one token, as typed or spaced at the boundary", () => {
    expect(termMatchers("d3")).toEqual([[["d3"], ["d 3"]]]);
    expect(termMatchers("b12")).toEqual([[["b12"], ["b 12"]]]);
    expect(termMatchers("om3")).toEqual([[["om3"], ["om 3"]]]);
    expect(termMatchers("x10")).toEqual([[["x10"], ["x 10"]]]);
  });
});

describe("catalog filter over the seed catalog (R-CAT-03)", () => {
  it.each(["d3", "b12", "om3"])("'%s' only finds products that contain it", (query) => {
    const matches = seedMatches(query);
    const spaced = query.replace(/(?<=[a-z])(?=\d)/, " ");

    expect(matches.length).toBeLessThan(seedSearchTexts.length / 10);
    expect(matches.every((text) => text.includes(query) || text.includes(spaced))).toBe(true);
  });

  it("'vitamina d3' finds vitamin D3 products", () => {
    const matches = seedMatches("vitamina d3");

    expect(matches.length).toBeGreaterThan(0);
    expect(matches.every((text) => text.includes("vitamina") && text.includes("d3"))).toBe(true);
  });

  it("finds a dose typed without a space like the spaced one", () => {
    expect(seedMatches("Losartán 50mg")).toEqual(seedMatches("losartan 50 mg"));
    expect(seedMatches("losartan50")).toEqual(seedMatches("losartan 50"));
    expect(seedMatches("losartan 50mg").length).toBeGreaterThan(0);
    expect(seedMatches("celecoxib 200mg x10")).toEqual(seedMatches("celecoxib 200 mg x 10"));
  });

  it("a glued dose is at least as precise as the spaced one ('5mg' ⊆ '5 mg')", () => {
    const glued = seedMatches("5mg");

    expect(glued.length).toBeGreaterThan(0);
    expect(glued.every((text) => text.includes("5 mg"))).toBe(true);
    expect(glued.length).toBeLessThanOrEqual(seedMatches("5 mg").length);
  });
});

describe("escapeLikePattern", () => {
  it("escapes LIKE wildcards and the escape character", () => {
    expect(escapeLikePattern("100%_a\\b")).toBe("100\\%\\_a\\\\b");
    expect(escapeLikePattern("losartan")).toBe("losartan");
  });
});
