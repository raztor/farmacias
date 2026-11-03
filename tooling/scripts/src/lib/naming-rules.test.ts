import { describe, expect, it } from "vitest";

import { isValidDirectoryName, isValidFileName } from "./naming-rules.ts";

describe("isValidFileName", () => {
  it.each([
    "index.ts",
    "user.service.ts",
    "user.service.test.ts",
    "sign-in-form.tsx",
    "button.stories.tsx",
    "_layout.tsx",
    "+not-found.tsx",
    "[id].tsx",
    "[...slug].tsx",
    "page.tsx",
    ".env.example",
  ])("acepta %s", (name) => {
    expect(isValidFileName(name)).toBe(true);
  });

  it.each(["UserService.ts", "signInForm.tsx", "user_service.ts", "README", "Button.stories.tsx"])(
    "rechaza %s",
    (name) => {
      expect(isValidFileName(name)).toBe(false);
    },
  );
});

describe("isValidDirectoryName", () => {
  it.each(["features", "sign-in", "(auth)", "[id]", "@modal", "_components"])(
    "acepta %s",
    (name) => {
      expect(isValidDirectoryName(name)).toBe(true);
    },
  );

  it.each(["SignIn", "sign_in", "Features"])("rechaza %s", (name) => {
    expect(isValidDirectoryName(name)).toBe(false);
  });
});
