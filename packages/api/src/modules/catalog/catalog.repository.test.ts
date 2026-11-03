import { describe, expect, it } from "vitest";

import { escapeLikePattern, termWords } from "./catalog.repository";

describe("catalog.repository helpers", () => {
  it("splits a normalized term into distinct words", () => {
    expect(termWords("celecoxib 200")).toEqual(["celecoxib", "200"]);
    expect(termWords("losartan")).toEqual(["losartan"]);
    expect(termWords("mg mg 50")).toEqual(["mg", "50"]);
    expect(termWords("")).toEqual([]);
  });

  it("escapes LIKE wildcards and the escape character", () => {
    expect(escapeLikePattern("100%_a\\b")).toBe("100\\%\\_a\\\\b");
    expect(escapeLikePattern("losartan")).toBe("losartan");
  });
});
