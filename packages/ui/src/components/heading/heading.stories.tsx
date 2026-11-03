import type { Meta, StoryObj } from "@storybook/react-native-web-vite";

import { Heading } from "./heading";
import { HEADING_LEVELS } from "./heading.variants";

const meta = {
  title: "UI/Heading",
  component: Heading,
  args: { children: "Bienvenido de vuelta", level: 1 },
  argTypes: {
    level: { control: "inline-radio", options: HEADING_LEVELS },
  },
} satisfies Meta<typeof Heading>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Level1: Story = {};

export const Level2: Story = { args: { level: 2, children: "Tu perfil" } };

export const Level3: Story = { args: { level: 3, children: "Preferencias de notificación" } };
