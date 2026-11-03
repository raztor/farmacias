import { preset } from "@repo/tailwind-config/preset";

/** @type {import("tailwindcss").Config} */
export default {
  content: ["./src/**/*.{ts,tsx}", "../../packages/ui/src/**/*.{ts,tsx}"],
  presets: [preset],
};
