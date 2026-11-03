import "./global.css";

import type { Decorator, Preview } from "@storybook/react-native-web-vite";

import { COLOR_SCHEMES, ColorSchemeFrame, isColorSchemeName } from "./color-scheme";

const withColorScheme: Decorator = (Story, context) => {
  const theme: unknown = context.globals.theme;
  return (
    <ColorSchemeFrame scheme={isColorSchemeName(theme) ? theme : "light"}>
      <Story />
    </ColorSchemeFrame>
  );
};

const preview: Preview = {
  decorators: [withColorScheme],
  globalTypes: {
    theme: {
      description: "Tema de color de los componentes",
      toolbar: {
        title: "Tema",
        icon: "mirror",
        items: COLOR_SCHEMES.map((value) => ({
          value,
          title: value === "light" ? "Claro" : "Oscuro",
        })),
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { theme: "light" },
  parameters: {
    layout: "padded",
    // The canvas background comes from the design tokens (see global.css), not from the addon.
    backgrounds: { disable: true },
    controls: {
      expanded: true,
      matchers: { color: /(background|color)$/i, date: /Date$/i },
    },
    a11y: { test: "error" },
    options: {
      storySort: { order: ["Introducción", "UI"] },
    },
  },
  tags: ["autodocs"],
};

export default preview;
