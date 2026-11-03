import { describe, expect, it } from "vitest";

import { cn } from "./cn";

describe("cn", () => {
  it("joins class names", () => {
    expect(cn("flex-row", "items-center")).toBe("flex-row items-center");
  });

  it("drops falsy values and supports conditional objects and arrays", () => {
    const classesFor = (isDisabled: boolean) =>
      cn("p-4", isDisabled && "opacity-50", null, undefined, { "gap-2": true, hidden: false }, [
        "rounded-md",
      ]);
    expect(classesFor(false)).toBe("p-4 gap-2 rounded-md");
    expect(classesFor(true)).toBe("p-4 opacity-50 gap-2 rounded-md");
  });

  it("lets later classes override conflicting ones", () => {
    expect(cn("px-4 py-2", "px-6")).toBe("py-2 px-6");
    expect(cn("bg-primary", "bg-destructive")).toBe("bg-destructive");
  });

  it("keeps semantic text colors and font sizes apart", () => {
    expect(cn("text-sm text-muted-foreground", "text-lg")).toBe("text-muted-foreground text-lg");
    expect(cn("text-foreground", "text-primary-foreground")).toBe("text-primary-foreground");
  });

  it("resolves conflicts per variant prefix", () => {
    expect(cn("bg-primary dark:bg-primary-dark", "dark:bg-card-dark")).toBe(
      "bg-primary dark:bg-card-dark",
    );
  });

  it("returns an empty string without classes", () => {
    expect(cn()).toBe("");
  });
});
