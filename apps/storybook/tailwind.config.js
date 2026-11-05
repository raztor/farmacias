import { preset } from "@repo/tailwind-config/preset";

/** @type {import("tailwindcss").Config} */
export default {
  content: [
    "../../packages/ui/src/**/*.{ts,tsx}",
    "./.storybook/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx,mdx}",
  ],
  presets: [preset],
};
